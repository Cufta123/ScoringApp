import React, { useState, useEffect } from 'react';

const HeatComponent = ({ event }) => {
  const [heats, setHeats] = useState([]);
  const [numHeats, setNumHeats] = useState(5); // Default number of heats

  const handleCreateHeats = async () => {
    try {
      const eventBoats = await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

      if (heats.length > 0) {
        alert('Heats already exist for this event.');
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
      handleDisplayHeats(); // Refresh the heats display
    } catch (error) {
      console.error('Error creating heats:', error);
      alert('Error creating heats. Please try again later.');
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
    } catch (error) {
      console.error('Error displaying heats and sailors:', error);
      alert('Error displaying heats and sailors. Please try again later.');
    }
  };

  useEffect(() => {
    handleDisplayHeats();
  }, []);

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
      <button onClick={handleCreateHeats}>Create Heats</button>
      <button onClick={handleDisplayHeats}>Display Heats</button>
      {heats.length > 0 && (
        <div className="heats-container">
          {heats.map((heat) => (
            <div key={heat.heat_id} className="heat-column">
              <h4>{heat.heat_name}</h4>
              <table>
                <thead>
                  <tr>
                    <th>Sailor Name</th>
                    <th>Boat Number</th>
                  </tr>
                </thead>
                <tbody>
                  {heat.boats.map((boat) => (
                    <tr key={boat.boat_id}>
                      <td>{boat.name} {boat.surname}</td>
                      <td>{boat.sail_number}</td>
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
