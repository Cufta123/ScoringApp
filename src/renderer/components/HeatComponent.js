/* eslint-disable react/require-default-props */
/* eslint-disable no-alert */
/* eslint-disable no-console */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import assignBoatsToNewHeatsZigZag from '../../main/functions/creatingNewHeatsZigZag';
import HeatTables from './heatComponents/HeatTables';
import handleStartFinalSeries from '../../main/functions/handleStartFinalSeries';
import CustomHeatAssignment from './CustomHeatsAssignment';

function HeatComponent({
  event,
  onHeatSelect = () => {},
  clickable,
  selectedHeatId = null,
  handleStartScoring = () => {},
  handleFinalSeriesStarted = () => {},
}) {
  const [heats, setHeats] = useState([]);
  const [numHeats, setNumHeats] = useState(5); // Default number of heats
  const [heatsCreated, setHeatsCreated] = useState(false);
  const [raceHappened, setRaceHappened] = useState(false);
  const [displayLastHeats, setDisplayLastHeats] = useState(true);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);
  const [showCustomAssignment, setShowCustomAssignment] = useState(false);
  const [customAssignment, setCustomAssignment] = useState([]);

  const fetchHeatsDetails = useCallback(async () => {
    const heatsRaw = await window.electron.sqlite.heatRaceDB.readAllHeats(
      event.event_id,
    );
    const details = await Promise.all(
      heatsRaw.map(async (heat) => {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
          heat.heat_id,
        );
        const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
          heat.heat_id,
        );
        return { ...heat, boats, raceNumber: races.length };
      }),
    );
    return details;
  }, [event.event_id]);

  const handleDisplayHeats = useCallback(async () => {
    try {
      const heatDetails = await fetchHeatsDetails();
      setHeats(heatDetails);
      setHeatsCreated(heatDetails.length > 0);
      setRaceHappened(heatDetails.some((heat) => heat.raceNumber > 0));
    } catch (error) {
      console.error('Error displaying heats:', error);
      setHeats([]);
      setHeatsCreated(false);
    }
  }, [fetchHeatsDetails]);

  const checkFinalSeriesStarted = useCallback(async () => {
    try {
      const allHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      setFinalSeriesStarted(
        allHeats.some((heat) => heat.heat_type === 'Final'),
      );
    } catch (error) {
      console.error('Error checking final series:', error);
    }
  }, [event.event_id]);

  useEffect(() => {
    checkFinalSeriesStarted();
  }, [checkFinalSeriesStarted]);

  const createHeats = async () => {
    if (raceHappened || finalSeriesStarted) {
      alert(
        'Heats cannot be generated because a race has been conducted or the final series has already started.',
      );
      return;
    }

    try {
      // Use customAssignment if available, otherwise fetch event boats.
      const eventBoats =
        customAssignment.length > 0
          ? customAssignment
          : await window.electron.sqlite.eventDB.readBoatsByEvent(
              event.event_id,
            );

      const existingHeats =
        await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

      if (existingHeats.length > 0) {
        alert(
          'Heats already exist for this event. Use the reset option to generate new heats.',
        );
        setHeatsCreated(true);
        return;
      }

      if (customAssignment.length === 0) {
        eventBoats.sort((a, b) => {
          if (a.boat_country < b.boat_country) return -1;
          if (a.boat_country > b.boat_country) return 1;
          return a.sail_number - b.sail_number;
        });
      }

      const heatPromises = [];
      for (let i = 0; i < numHeats; i += 1) {
        const heatName = `Heat ${String.fromCharCode(65 + i)}1`;
        heatPromises.push(
          window.electron.sqlite.heatRaceDB.insertHeat(
            event.event_id,
            heatName,
            'Qualifying',
          ),
        );
      }
      await Promise.all(heatPromises);

      // Refetch heats and assign boats using assignBoatsToNewHeatsZigZag
      const fetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      const assignments = assignBoatsToNewHeatsZigZag(eventBoats, fetchedHeats);

      const heatBoatPromises = assignments.map(({ heatId, boatId }) =>
        window.electron.sqlite.heatRaceDB.insertHeatBoat(heatId, boatId),
      );
      await Promise.all(heatBoatPromises);

      alert('Heats have been generated successfully!');
      setHeatsCreated(true);
      await handleDisplayHeats();
    } catch (error) {
      console.error('Error generating heats:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Error generating heats: ${errorMessage}`);
    }
  };

  const handleCreateHeats = async () => {
    await createHeats();
  };

  const handleRecreateHeats = async () => {
    if (raceHappened || finalSeriesStarted) {
      alert(
        'Heats cannot be reset because a race has been conducted or the final series has already started.',
      );
      return;
    }
    try {
      await window.electron.sqlite.heatRaceDB.deleteHeatsByEvent(
        event.event_id,
      );
      await createHeats();
    } catch (error) {
      console.error('Error generating heats:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Error generating heats: ${errorMessage}`);
    }
  };

  useEffect(() => {
    setRaceHappened(false); // Reset state when event changes
    handleDisplayHeats();
  }, [event, handleDisplayHeats]);

  const toggleDisplayMode = () => {
    setDisplayLastHeats((prev) => !prev);
  };

  const getLastHeats = (heatsList) => {
    const finals = heatsList.filter(
      (heat) => heat.heat_type.toLowerCase() === 'final',
    );
    if (finals.length) return finals;

    // Determine last heat per group based on heat name format
    const lastSuffixPerGroup = heatsList.reduce((acc, heat) => {
      const match = heat.heat_name.match(/([A-Z]+)(\d*)$/);
      if (match) {
        const [, group, suffix] = match;
        const numSuffix = suffix ? parseInt(suffix, 10) : 0;
        acc[group] = Math.max(acc[group] || 0, numSuffix);
      }
      return acc;
    }, {});

    return heatsList.filter((heat) => {
      const match = heat.heat_name.match(/([A-Z]+)(\d*)$/);
      if (!match) return false;
      const [, group, suffix] = match;
      const numSuffix = suffix ? parseInt(suffix, 10) : 0;
      return numSuffix === lastSuffixPerGroup[group];
    });
  };

  const initiateFinalSeries = () => {
    const confirmed = window.confirm(
      'Are you sure you want to begin the final series? This action cannot be undone.',
    );
    if (confirmed) {
      handleFinalSeriesStarted();
      handleStartFinalSeries({
        event,
        setFinalSeriesStarted,
        handleDisplayHeats,
      });
    }
  };

  const handleCustomAssignment = async (customBoats) => {
    try {
      // Instead of deleting/recreating heats here, simply store the custom assignment array.
      setCustomAssignment(customBoats);
      alert('Custom assignment saved.');
    } catch (error) {
      console.error('Error applying custom assignment:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Error applying custom assignment: ${errorMessage}`);
    }
    setShowCustomAssignment(false);
  };
  const heatsToDisplay = displayLastHeats ? getLastHeats(heats) : heats;

  return (
    <div>
      <div>
        {!showCustomAssignment && !raceHappened && !finalSeriesStarted && (
          <>
            <label htmlFor="numHeats">Select Number of Heats:</label>
            <select
              id="numHeats"
              style={{ maxWidth: '70px' }}
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
              {heatsCreated ? 'Reset and Generate Heats' : 'Generate New Heats'}
            </button>
            <button
              type="button"
              onClick={() => setShowCustomAssignment(true)}
              disabled={raceHappened || finalSeriesStarted}
            >
              {customAssignment.length > 0
                ? 'Edit Custom Assignment (Active)'
                : 'Custom Heat Assignment'}
            </button>
            {customAssignment.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to clear the custom assignment?',
                    )
                  ) {
                    setCustomAssignment([]);
                    alert('Custom assignment cleared.');
                  }
                }}
                disabled={raceHappened || finalSeriesStarted}
              >
                Clear Custom Assignment
              </button>
            )}
          </>
        )}
      </div>

      {showCustomAssignment && (
        <CustomHeatAssignment
          event={event}
          onSave={handleCustomAssignment}
          onCancel={() => setShowCustomAssignment(false)}
        />
      )}

      {raceHappened && (
        <button type="button" onClick={toggleDisplayMode}>
          {displayLastHeats ? 'View All Heats' : 'View Final Heats'}
        </button>
      )}

      {raceHappened && !finalSeriesStarted && (
        <button type="button" onClick={initiateFinalSeries}>
          Begin Final Series
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
    // Other event properties can be added here...
  }).isRequired,
  onHeatSelect: PropTypes.func,
  clickable: PropTypes.bool.isRequired,
  selectedHeatId: PropTypes.number,
  handleStartScoring: PropTypes.func,
  handleFinalSeriesStarted: PropTypes.func,
};

export default HeatComponent;
