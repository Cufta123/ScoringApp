/* eslint-disable no-alert */
/* eslint-disable no-console */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import assignBoatsToNewHeatsZigZag from '../../main/functions/creatingNewHeatsZigZag';
import HeatTables from './heatComponents/HeatTables';
import handleStartFinalSeries from '../../main/functions/handleStartFinalSeries';

function HeatComponent({
  event,
  onHeatSelect = () => {},
  clickable,
  selectedHeatId,
  handleStartScoring,
}) {
  const [heats, setHeats] = useState([]);
  const [numHeats, setNumHeats] = useState(5); // Default number of heats

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
      const allHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      const finalHeats = allHeats.filter((heat) => heat.heat_type === 'Final');
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
        if (a.boat_country < b.boat_country) return -1;
        if (a.boat_country > b.boat_country) return 1;
        return a.sail_number - b.sail_number;
      });

      const heatPromises = [];
      for (let i = 0; i < numHeats; i += 1) {
        const heatName = `Heat ${String.fromCharCode(65 + i)}1`;
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
      // Fetch the newly created heats from the DB
      const fetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );

      console.log('fetchedHeats:', fetchedHeats);
      console.log('eventBoats:', eventBoats);

      // Use the zigzag function to determine assignments.
      // The function now returns objects with the actual heat_id.
      const assignments = assignBoatsToNewHeatsZigZag(eventBoats, fetchedHeats);
      console.log('assignments:', assignments);

      // Insert each boat into its assigned heat using the actual heat id
      const heatBoatPromises = assignments.map(({ heatId, boatId }) => {
        return window.electron.sqlite.heatRaceDB.insertHeatBoat(heatId, boatId);
      });
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
      alert('Error recreating heats. Please try again later.');
    }
  };

  useEffect(() => {
    setRaceHappened(false); // Reset raceHappened state when event changes
    handleDisplayHeats();
  }, [event, handleDisplayHeats]);

  const toggleDisplayMode = () => {
    setDisplayLastHeats((prevMode) => !prevMode);
  };

  const getLastHeats = (heatsList) => {
    const finalHeats = heatsList.filter(
      (heat) => heat.heat_type.toLowerCase() === 'final',
    );
    if (finalHeats.length > 0) {
      return finalHeats;
    }

    const heatGroups = heatsList.reduce((acc, heat) => {
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
      {!finalSeriesStarted && (
        <button
          type="button"
          onClick={() =>
            handleStartFinalSeries({
              event,
              setFinalSeriesStarted,
              handleDisplayHeats,
            })
          }
        >
          Start Final Series
        </button>
      )}
      {heatsToDisplay.length > 0 && (
        <HeatTables
          heatsToDisplay={heatsToDisplay}
          raceHappened={raceHappened}
          finalSeriesStarted={finalSeriesStarted}
          onHeatSelect={onHeatSelect}
          clickable={clickable}
          handleDisplayHeats={handleDisplayHeats}
          selectedHeatId={selectedHeatId}
          handleStartScoring={handleStartScoring}
        />
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
