/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable camelcase */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import HeatComponent from '../../components/HeatComponent';
import ScoringInputComponent from '../../components/ScoringInputComponent';
import printNewHeats from '../../../main/functions/printNewHeats';
import './HeatRacePage.css';

function HeatRacePage() {
  const { state: { event } = {} } = useLocation();
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(event || null);
  const [selectedHeat, setSelectedHeat] = useState(null);
  const [isScoring, setIsScoring] = useState(false);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);
  const [heats, setHeats] = useState([]);
  const [allHeatsEqual, setAllHeatsEqual] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');

  // Fetch event data if needed
  useEffect(() => {
    if (!eventData && event) {
      window.electron.sqlite.eventDB
        .readEventById(event.event_id)
        .then(setEventData)
        .catch((error) =>
          console.error(`Error fetching event: ${error.message}`),
        );
    }
  }, [eventData, event]);

  // Update heats list
  const fetchHeats = useCallback(() => {
    if (event?.event_id) {
      window.electron.sqlite.heatRaceDB
        .readAllHeats(event.event_id)
        .then(setHeats)
        .catch((error) =>
          console.error('Error updating heats:', error.message),
        );
    }
  }, [event]);

  useEffect(() => {
    if (event?.event_id) {
      fetchHeats();
    }
  }, [event, fetchHeats]);

  // Check if final series has started
  const checkFinalSeriesStarted = useCallback(async () => {
    if (event?.event_id) {
      try {
        const data = await window.electron.sqlite.heatRaceDB.readAllHeats(
          event.event_id,
        );
        if (data.some((heat) => heat.heat_type === 'Final')) {
          setFinalSeriesStarted(true);
        }
      } catch (error) {
        console.error('Error checking final series:', error.message);
      }
    }
  }, [event]);

  useEffect(() => {
    checkFinalSeriesStarted();
  }, [checkFinalSeriesStarted]);

  // Check if all latest heats have the same non-zero number of races
  const evaluateHeatsEquality = useCallback(async () => {
    if (event?.event_id) {
      try {
        const results = await window.electron.sqlite.heatRaceDB.readAllHeats(
          event.event_id,
        );
        const latestHeats = results.reduce((acc, heat) => {
          const match = heat.heat_name.match(/Heat ([A-Z]+)(\d*)/);
          if (match) {
            const [, base, suffix] = match;
            const numericSuffix = suffix ? parseInt(suffix, 10) : 0;
            if (!acc[base] || numericSuffix > acc[base].suffix) {
              acc[base] = { suffix: numericSuffix, heat };
            }
          }
          return acc;
        }, {});

        const lastHeats = Object.values(latestHeats).map((entry) => entry.heat);
        const raceCounts = await Promise.all(
          lastHeats.map(async (heat) => {
            const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
              heat.heat_id,
            );
            return races ? races.length : null;
          }),
        );

        // If any race count is null or 0, equality check fails.
        if (raceCounts.includes(null) || raceCounts[0] === 0) {
          setAllHeatsEqual(false);
          return false;
        }

        const equal = raceCounts.every((count) => count === raceCounts[0]);
        setAllHeatsEqual(equal);
        return equal;
      } catch (error) {
        console.error('Error checking heats equality:', error.message);
        setAllHeatsEqual(false);
        return false;
      }
    }
  }, [event]);

  useEffect(() => {
    evaluateHeatsEquality();
  }, [heats, event, evaluateHeatsEquality]);

  const handleHeatSelect = (heat) => setSelectedHeat(heat);
  const handleStartScoring = () => setIsScoring(true);
  const handleBackToHeats = () => setIsScoring(false);

  const handleSubmitScores = async (placeNumbers) => {
    console.log('Submitted place numbers:', placeNumbers);
    try {
      // Fetch races and create a new one
      const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
        selectedHeat.heat_id,
      );
      const nextRaceNumber = races.length + 1;

      const { lastInsertRowid: raceId } =
        await window.electron.sqlite.heatRaceDB.insertRace(
          selectedHeat.heat_id,
          nextRaceNumber,
        );

      // insert scores for the new race
      await Promise.all(
        placeNumbers.map(async ({ boatNumber, place, status }) => {
          const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
            selectedHeat.heat_id,
          );
          const boatDetails = boats.find(
            (boat) => boat.sail_number === boatNumber,
          );
          if (boatDetails) {
            await window.electron.sqlite.heatRaceDB.insertScore(
              raceId,
              boatDetails.boat_id,
              place,
              place,
              status,
            );
          }
        }),
      );

      if (!finalSeriesStarted) {
        const allEqual = await evaluateHeatsEquality();
        if (allEqual) {
          await window.electron.sqlite.heatRaceDB.updateEventLeaderboard(
            event.event_id,
          );
        } else {
          console.log(
            'Not all heats have the same number of races. Local leaderboard will not be updated.',
          );
        }
      } else {
        console.log('Final series has started. Leaderboard will be updated.');
        await window.electron.sqlite.heatRaceDB.updateFinalLeaderboard(
          event.event_id,
        );
      }

      setIsScoring(false);
      setSelectedHeat({ ...selectedHeat, raceNumber: nextRaceNumber });
      fetchHeats();
    } catch (error) {
      console.error('Error submitting scores:', error.message);
    }
  };

  const handleCreateNewHeatsBasedOnLeaderboard = async () => {
    if (finalSeriesStarted) {
      alert(
        'Cannot create new heats based on leaderboard after the final series has started.',
      );
      return;
    }

    try {
      await window.electron.sqlite.heatRaceDB.createNewHeatsBasedOnLeaderboard(
        event.event_id,
      );
      console.log('New heats created based on leaderboard.');
      fetchHeats();
    } catch (error) {
      console.error(
        'Error creating new heats based on leaderboard:',
        error.message,
      );
    }
  };

  const handlePrintNewHeats = async () => {
    try {
      const latestHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      await printNewHeats(event, latestHeats, exportFormat);
    } catch (error) {
      console.error('Error printing new heats:', error.message);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={isScoring ? handleBackToHeats : () => navigate(-1)}
      >
        {isScoring ? 'Back to Heats' : 'Back'}
      </button>
      {!isScoring ? (
        <>
          <HeatComponent
            key={JSON.stringify(heats)}
            event={event}
            heats={heats}
            onHeatSelect={handleHeatSelect}
            clickable
            selectedHeatId={selectedHeat?.heat_id}
            handleStartScoring={handleStartScoring}
            handleFinalSeriesStarted={() => setFinalSeriesStarted(true)}
          />

          {/* Render "Create New Heats" button only when allowed */}
          {!finalSeriesStarted && allHeatsEqual && (
            <button
              type="button"
              onClick={handleCreateNewHeatsBasedOnLeaderboard}
            >
              Create New Heats
            </button>
          )}

          {!finalSeriesStarted && (
            <>
              <select
                id="exportFormat"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                style={{ maxWidth: '80px' }}
              >
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="html">HTML</option>
              </select>
              <button type="button" onClick={handlePrintNewHeats}>
                Print new heats
              </button>
            </>
          )}
        </>
      ) : (
        <ScoringInputComponent
          heat={selectedHeat}
          onSubmit={handleSubmitScores}
          onBack={handleBackToHeats}
        />
      )}
    </div>
  );
}

export default HeatRacePage;
