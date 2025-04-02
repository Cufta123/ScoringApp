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
  const [needsLeaderboardUpdate, setNeedsLeaderboardUpdate] = useState(false);
  const [deleteHeatMode, setDeleteHeatMode] = useState(false);
  const [deleteRaceMode, setDeleteRaceMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    } else {
      return false;
    }
  }, [event]);

  useEffect(() => {
    evaluateHeatsEquality();
  }, [heats, event, evaluateHeatsEquality]);

  const handleHeatDelete = useCallback(
    async (heat) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete heat "${heat.heat_name}"?`,
      );
      if (!confirmed) return;
      try {
        await window.electron.sqlite.heatRaceDB.deleteHeatById(heat.heat_id);
        fetchHeats();
        setDeleteHeatMode(false);
      } catch (error) {
        console.error('Error deleting heat:', error.message);
      }
    },
    [fetchHeats],
  );
  const cancelDeleteMode = () => {
    setDeleteHeatMode(false);
    setDeleteRaceMode(false);
    setShowDeleteModal(false);
  };
  const handleDeleteLastHeats = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete the last heats?',
    );
    if (!confirmed) return;
    try {
      await window.electron.sqlite.heatRaceDB.deleteLastCreatedHeatsWithRaces(
        event.event_id,
      );
      fetchHeats();
      setNeedsLeaderboardUpdate(true);
    } catch (error) {
      console.error('Error deleting last heats:', error.message);
    }
  }, [event.event_id, fetchHeats]);

  const handleRaceDelete = useCallback(
    async (heat) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete the last race for heat "${heat.heat_name}"?`,
      );
      if (!confirmed) return;
      try {
        await window.electron.sqlite.heatRaceDB.deleteLastRaceForHeat(
          heat.heat_id,
        );
        fetchHeats();
        setNeedsLeaderboardUpdate(true);
        cancelDeleteMode(); // Exit delete mode on successful deletion
      } catch (error) {
        console.error('Error deleting race:', error.message);
      }
    },
    [fetchHeats], // cancelDeleteMode is defined within the same scope so it can be called here.
  );

  const handleHeatSelect = useCallback(
    (heat) => {
      if (deleteHeatMode) {
        handleHeatDelete(heat);
      } else if (deleteRaceMode) {
        handleRaceDelete(heat);
      } else {
        setSelectedHeat(heat);
      }
    },
    [deleteHeatMode, deleteRaceMode, handleHeatDelete, handleRaceDelete],
  );

  const handleStartScoring = useCallback(() => {
    setIsScoring(true);
  }, []);

  const handleBackToHeats = useCallback(() => {
    setIsScoring(false);
  }, []);

  const handleSubmitScores = useCallback(
    async (placeNumbers) => {
      console.log('Submitted place numbers:', placeNumbers);
      try {
        const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
          selectedHeat.heat_id,
        );
        const nextRaceNumber = races.length + 1;

        const { lastInsertRowid: raceId } =
          await window.electron.sqlite.heatRaceDB.insertRace(
            selectedHeat.heat_id,
            nextRaceNumber,
          );

        await Promise.all(
          placeNumbers.map(async ({ boatNumber, place, status }) => {
            const boats =
              await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
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
              false,
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
    },
    [
      selectedHeat,
      finalSeriesStarted,
      evaluateHeatsEquality,
      event,
      fetchHeats,
    ],
  );

  const handleCreateNewHeatsBasedOnLeaderboard = useCallback(async () => {
    if (finalSeriesStarted) {
      alert(
        'Operation not allowed: The final series has begun, so new heats cannot be created based on the leaderboard.',
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
  }, [finalSeriesStarted, event, fetchHeats]);

  const handlePrintNewHeats = useCallback(async () => {
    try {
      const latestHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      await printNewHeats(event, latestHeats, exportFormat, finalSeriesStarted);
    } catch (error) {
      console.error('Error printing new heats:', error.message);
    }
  }, [event, exportFormat, finalSeriesStarted]);

  const handleUpdateLeaderboard = useCallback(async () => {
    if (!finalSeriesStarted) {
      await window.electron.sqlite.heatRaceDB.updateEventLeaderboard(
        event.event_id,
        false,
      );
    } else {
      console.log('Final series has started. Leaderboard will be updated.');
      await window.electron.sqlite.heatRaceDB.updateFinalLeaderboard(
        event.event_id,
      );
    }
  }, [finalSeriesStarted, event]);

  useEffect(() => {
    if (needsLeaderboardUpdate) {
      handleUpdateLeaderboard();
      setNeedsLeaderboardUpdate(false);
    }
  }, [needsLeaderboardUpdate, handleUpdateLeaderboard]);

  const toggleDeleteOptionsModal = () => {
    setShowDeleteModal((prev) => !prev);
    setSelectedHeat(null); // clear selection so blue border is removed
  };

  const selectDeleteRaceMode = () => {
    setDeleteRaceMode(true);
    setDeleteHeatMode(false);
    setShowDeleteModal(false);
  };

  return (
    <div className="heat-race-page">
      <header className="header-buttons">
        <button
          type="button"
          className="btn btn-primary"
          onClick={isScoring ? handleBackToHeats : () => navigate(-1)}
        >
          {isScoring ? 'Back to Heats' : 'Back'}
        </button>
        {!isScoring &&
          !showDeleteModal &&
          !deleteRaceMode &&
          !deleteHeatMode && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={toggleDeleteOptionsModal}
            >
              Delete Options
            </button>
          )}
      </header>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Deletion Options</h3>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteLastHeats}
            >
              Delete Heats
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={selectDeleteRaceMode}
            >
              Delete Last Race
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelDeleteMode}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <main className="content-container">
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
              showDeleteModal={showDeleteModal}
              deleteRaceMode={deleteRaceMode}
              deleteHeatMode={deleteHeatMode} // newly passed
            />
            {deleteRaceMode && (
              <div className="delete-mode-prompt">
                Delete Mode Active: Click on a heat table to delete its last
                race.
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelDeleteMode}
                >
                  Cancel
                </button>
              </div>
            )}
            {deleteHeatMode && (
              <div className="delete-mode-prompt">
                Delete Mode Active: Click on a heat table to delete the entire
                heat.
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelDeleteMode}
                >
                  Cancel
                </button>
              </div>
            )}
            {!finalSeriesStarted && allHeatsEqual && !showDeleteModal && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateNewHeatsBasedOnLeaderboard}
              >
                Create New Heats
              </button>
            )}
          </>
        ) : (
          <ScoringInputComponent
            heat={selectedHeat}
            onSubmit={handleSubmitScores}
            onBack={handleBackToHeats}
          />
        )}
      </main>

      {!isScoring && !showDeleteModal && !deleteRaceMode && (
        <footer className="footer-controls">
          <select
            id="exportFormat"
            className="form-select"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            style={{ maxWidth: '80px' }}
          >
            <option value="excel">Excel</option>
            <option value="pdf">PDF</option>
            <option value="html">HTML</option>
          </select>
          {!finalSeriesStarted ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrintNewHeats}
            >
              Print new heats
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrintNewHeats}
            >
              Print Final Series
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

export default HeatRacePage;
