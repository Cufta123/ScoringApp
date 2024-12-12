import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

function HeatComponent({ event, onHeatSelect = () => {}, clickable }) {
  const [heats, setHeats] = useState([]);
  const [numHeats, setNumHeats] = useState(5); // Default number of heats
  const [selectedHeatId, setSelectedHeatId] = useState(null);
  const [heatsCreated, setHeatsCreated] = useState(false);
  const [raceHappened, setRaceHappened] = useState(false);
  const [displayLastHeats, setDisplayLastHeats] = useState(true);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);


  const handleDisplayHeats = useCallback(async () => {
    try {
      const heatsToDisplay =
        await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      const heatDetailsPromises = heatsToDisplay.map(async (heat) => {
        const boatsInHeat =
          await window.electron.sqlite.heatRaceDB.readBoatsByHeat(heat.heat_id);
        const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
          heat.heat_id,
        );
        return {
          ...heat,
          boats: boatsInHeat,
          raceNumber: races.length,
        };
      });

      const heatDetails = await Promise.all(heatDetailsPromises);
      setHeats(heatDetails);
      setHeatsCreated(heatDetails.length > 0);

      // Check if any race has happened
      const anyRaceHappened = heatDetails.some((heat) => heat.raceNumber > 0);
      setRaceHappened(anyRaceHappened);
    } catch (error) {
      // Handle error appropriately
      setHeats([]);
      setHeatsCreated(false);
    }
  }, [event.event_id]);

  const checkFinalSeriesStarted = useCallback(async () => {
    try {
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      const finalHeats = heats.filter(heat => heat.heat_type === 'Final');
      if (finalHeats.length > 0) {
        setFinalSeriesStarted(true);
      }
    } catch (error) {
      console.error('Error checking final series:', error);
    }
  }, [event.event_id]);

  useEffect(() => {
    checkFinalSeriesStarted();
  }, [checkFinalSeriesStarted]);


  const handleStartFinalSeries = async () => {
    if (finalSeriesStarted) {
      return;
    }
    try {
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      const qualifyingHeats = heats.filter(heat => heat.heat_type === 'Qualifying');
      const numHeats = new Set(qualifyingHeats.map(heat => heat.heat_name.match(/Heat ([A-Z])/)[1])).size;

      // Fetch leaderboard to rank boats
      const leaderboard = await window.electron.sqlite.heatRaceDB.readLeaderboard(event.event_id);

      // Determine fleet sizes
      const boatsPerFleet = Math.floor(leaderboard.length / numHeats);
      const extraBoats = leaderboard.length % numHeats;

      const fleetNames = ['Gold', 'Silver', 'Bronze', 'Copper'];
      const fleetPromises = [];

      let boatIndex = 0;
      for (let i = 0; i < numHeats; i++) {
        const fleetName = fleetNames[i] || `Fleet ${i + 1}`;
        const heatName = `Heat ${fleetName}`;
        const heatType = 'Final';

        // Insert new heat for the final series
        const { lastInsertRowid: newHeatId } = await window.electron.sqlite.heatRaceDB.insertHeat(
          event.event_id,
          heatName,
          heatType
        );

        const boatsInThisFleet = boatsPerFleet + (i < extraBoats ? 1 : 0);
        for (let j = 0; j < boatsInThisFleet; j++) {
          fleetPromises.push(
            window.electron.sqlite.heatRaceDB.insertHeatBoat(newHeatId, leaderboard[boatIndex].boat_id)
          );
          boatIndex++;
        }
      }

      await Promise.all(fleetPromises);
      setIsFinalSeries(true);
      setFinalSeriesStarted(true); // Set final series started to true
      alert('Final Series started successfully!');
      handleDisplayHeats(); // Refresh the heats display
    } catch (error) {
      console.error('Error starting final series:', error);
      alert('Error starting final series. Please try again later.');
    }
  };


const handleCreateHeats = async () => {
  if (raceHappened || finalSeriesStarted) {
    alert('Cannot create heats after a race has happened.');
    return;
  }

  try {
    const eventBoats = await window.electron.sqlite.eventDB.readBoatsByEvent(
      event.event_id,
    );
    const existingHeats =
      await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

    if (existingHeats.length > 0) {
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
      heatPromises.push(
        window.electron.sqlite.heatRaceDB.insertHeat(
          event.event_id,
          heatName,
          heatType,
        ),
      );
    }
    await Promise.all(heatPromises);

    const FetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
      event.event_id,
    );

    // Calculate the number of boats per heat
    const boatsPerHeat = Math.floor(eventBoats.length / numHeats);
    const extraBoats = eventBoats.length % numHeats;

    const heatBoatPromises = [];
    let boatIndex = 0;

    for (let i = 0; i < numHeats; i += 1) {
      const heat = FetchedHeats.find(
        (h) => h.heat_name === `Heat ${String.fromCharCode(65 + i)}`,
      );
      const boatsInThisHeat = boatsPerHeat + (i < extraBoats ? 1 : 0);

      for (let j = 0; j < boatsInThisHeat; j += 1) {
        heatBoatPromises.push(
          window.electron.sqlite.heatRaceDB.insertHeatBoat(
            heat.heat_id,
            eventBoats[boatIndex].boat_id,
          ),
        );
        boatIndex += 1;
      }
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
    if (raceHappened || finalSeriesStarted) {
      alert('Cannot recreate heats after a race has happened.');
      return;
    }

    try {
      await window.electron.sqlite.heatRaceDB.deleteHeatsByEvent(
        event.event_id,
      );
      await handleCreateHeats();
    } catch (error) {
      console.error('Error recreating heats:', error);
      console.error('Error recreating heats. Please try again later.');
    }
  };

  useEffect(() => {
    setRaceHappened(false); // Reset raceHappened state when event changes
    handleDisplayHeats();
  }, [event, handleDisplayHeats]);

  const handleHeatClick = (heat) => {
    if (clickable) {
      setSelectedHeatId(heat.heat_id);
      onHeatSelect(heat);
    }
  };

  const toggleDisplayMode = () => {
    setDisplayLastHeats((prevMode) => !prevMode);
  };

  const getLastHeats = (heats) => {
    const finalHeats = heats.filter((heat) => heat.heat_type.toLowerCase() === 'final');
    if (finalHeats.length > 0) {
      return finalHeats;
    }

    const heatGroups = heats.reduce((acc, heat) => {
      const match = heat.heat_name.match(/([A-Z]+)(\d*)$/);
      if (match) {
        const [_, group, suffix] = match;
        const suffixNumber = suffix ? parseInt(suffix, 10) : 0;
        if (!acc[group] || acc[group] < suffixNumber) {
          acc[group] = suffixNumber;
        }
      }
      return acc;
    }, {});

    return heats.filter((heat) => {
      const match = heat.heat_name.match(/([A-Z]+)(\d*)$/);
      if (match) {
        const [_, group, suffix] = match;
        const suffixNumber = suffix ? parseInt(suffix, 10) : 0;
        return suffixNumber === heatGroups[group];
      }
      return false;
    });
  };


  const heatsToDisplay = displayLastHeats ? getLastHeats(heats) : heats;

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
        {!raceHappened && !finalSeriesStarted && (
          <>
            <label htmlFor="numHeats">Number of Heats:</label>
            <select
              id="numHeats"
              value={numHeats}
              onChange={(e) => setNumHeats(Number(e.target.value))}
              disabled={raceHappened || finalSeriesStarted}
            >
              {[...Array(10).keys()].map((i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={heatsCreated ? handleRecreateHeats : handleCreateHeats}
              disabled={raceHappened || finalSeriesStarted}
            >
              {heatsCreated ? 'Recreate Heats' : 'Create Heats'}
            </button>
          </>
        )}
      </div>

      <button type="button" onClick={toggleDisplayMode}>
        {displayLastHeats ? 'Show All Heats' : 'Show Last Heats'}
      </button>
      { !finalSeriesStarted && (
        <button type="button" onClick={handleStartFinalSeries}>
          Start Final Series
        </button>
      )}
      {heatsToDisplay.length > 0 && (
        <div style={heatsContainerStyle} className="heats-container">
          {heatsToDisplay.map((heat) => (
            <div
              key={heat.heat_id}
              style={
                heat.heat_id === selectedHeatId
                  ? selectedHeatColumnStyle
                  : heatColumnStyle
              }
              className="heat-column"
              onClick={() => handleHeatClick(heat)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleHeatClick(heat);
                }
              }}
            >
              <h4>
                {heat.heat_name} (Race {heat.raceNumber})
              </h4>
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
                      <td style={sailorNameColumnStyle}>
                        {boat.name} {boat.surname}
                      </td>
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
}

HeatComponent.propTypes = {
  event: PropTypes.shape({
    event_id: PropTypes.number.isRequired,
    // Add other event properties here if needed
  }).isRequired,
  onHeatSelect: PropTypes.func,
  clickable: PropTypes.bool.isRequired,
};

export default HeatComponent;
