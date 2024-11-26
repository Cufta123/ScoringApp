import React, { useState, useEffect } from 'react';

const HeatComponent = ({ event, onHeatSelect, clickable }) => {
  const [heats, setHeats] = useState([]);
  const [numHeats, setNumHeats] = useState(5); // Default number of heats
  const [selectedHeatId, setSelectedHeatId] = useState(null);
  const [heatsCreated, setHeatsCreated] = useState(false);

  const handleCreateHeats = async () => {
    try {
      const eventBoats = await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

      if (heats.length > 0) {
        alert('Heats already exist for this event.');
        setHeatsCreated(true);
        return;
      }

      eventBoats.sort((a, b) => {
        if (a.country < b.country) return -1;
        if (a.country > b.country) return 1;
        return a.sail_number - b.sail_number;
      });

      const heatPromises = [];
      for (let i = 0; i < numHeats; i += 1) {
        const heatName = `Heat ${String.fromCharCode(65 + i)}`;
        const heatType = 'Qualifying';
        heatPromises.push(window.electron.sqlite.heatRaceDB.insertHeat(event.event_id, heatName, heatType));
      }
      await Promise.all(heatPromises);

      const FetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      const heatOrder = Array.from({ length: numHeats }, (_, i) => String.fromCharCode(65 + i)).concat(
        Array.from({ length: numHeats }, (_, i) => String.fromCharCode(65 + numHeats - 1 - i))
      );
      const heatBoatPromises = [];
      for (let i = 0; i < eventBoats.length; i += 1) {
        const heatIndex = i % heatOrder.length;
        const heat = FetchedHeats.find(h => h.heat_name === `Heat ${heatOrder[heatIndex]}`);
        heatBoatPromises.push(window.electron.sqlite.heatRaceDB.insertHeatBoat(heat.heat_id, eventBoats[i].boat_id));
      }
      await Promise.all(heatBoatPromises);

      alert('Heats created successfully!');
      setHeatsCreated(true);
      handleDisplayHeats(); // Refresh the heats display
    } catch (error) {
      console.error('Error creating heats:', error);
      alert('Error creating heats. Please try again later.');
    }
  };

  const handleRecreateHeats = async () => {
    try {
      await window.electron.sqlite.heatRaceDB.deleteHeatsByEvent(event.event_id);
      await handleCreateHeats();
    } catch (error) {
      console.error('Error recreating heats:', error);
      alert('Error recreating heats. Please try again later.');
    }
  };

  const handleDisplayHeats = async () => {
    try {
      const heatsToDisplay = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      const heatDetailsPromises = heatsToDisplay.map(async (heat) => {
        const boatsInHeat = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(heat.heat_id);
        return {
          ...heat,
          boats: boatsInHeat,
        };
      });

      const heatDetails = await Promise.all(heatDetailsPromises);
      setHeats(heatDetails);
      setHeatsCreated(heatDetails.length > 0);
    } catch (error) {
      console.error('Error displaying heats and sailors:', error);
      alert('Error displaying heats and sailors. Please try again later.');
    }
  };

  useEffect(() => {
    handleDisplayHeats();
  }, []);

  const handleHeatClick = (heat) => {
    if (clickable) {
      setSelectedHeatId(heat.heat_id);
      onHeatSelect(heat);
    }
  };

  const heatsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '10px',
  };

  const heatColumnStyle = {
    backgroundColor: '#f0f0f0',
    border: '2px solid #ccc',
    borderRadius: '5px',
    padding: '10px',
    maxWidth: '400px', // Set max width
    flex: '1 1 30%', // Ensure only 4 columns per row with uniform spacing
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    cursor: clickable ? 'pointer' : 'default',
  };
  const selectedHeatColumnStyle = {
    ...heatColumnStyle,
    border: '2px solid #007bff', // Blue border to highlight the selected heat
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)', // Add shadow for more emphasis
  };
  const boatNumberColumnStyle = {
    ...heatColumnStyle,
    maxWidth: '100px', // Shorter width for boat number
  };

  const sailorNameColumnStyle = {
    ...heatColumnStyle,
    maxWidth: '400px', // Wider width for sailor name
  };

  return (
    <div>
      <div>
        <label htmlFor="numHeats">Number of Heats:</label>
        <select id="numHeats" value={numHeats} onChange={(e) => setNumHeats(Number(e.target.value))}>
          {[...Array(10).keys()].map(i => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
      </div>
      <button onClick={heatsCreated ? handleRecreateHeats : handleCreateHeats}>
        {heatsCreated ? 'Recreate Heats' : 'Create Heats'}
      </button>
      {heats.length > 0 && (
        <div style={heatsContainerStyle} className="heats-container">
          {heats.map((heat) => (
            <div
              key={heat.heat_id}
              style={heat.heat_id === selectedHeatId ? selectedHeatColumnStyle : heatColumnStyle}
              className="heat-column"
              onClick={() => handleHeatClick(heat)}
            >
              <h4>{heat.heat_name}</h4>
              <table>
                <thead>
                  <tr>
                    <th style={sailorNameColumnStyle}>Sailor Name</th>
                    <th>Country</th>
                    <th style={boatNumberColumnStyle}>Boat Number</th>
                  </tr>
                </thead>
                <tbody>
                  {heat.boats.map((boat) => (
                    <tr key={boat.boat_id}>
                      <td style={sailorNameColumnStyle}>{boat.name} {boat.surname}</td>
                      <td>{boat.country}</td>
                      <td style={boatNumberColumnStyle}>{boat.sail_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeatComponent;