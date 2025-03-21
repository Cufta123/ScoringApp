/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable camelcase */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Flag from 'react-world-flags';
import iocToFlagCodeMap from '../constants/iocToFlagCodeMap';
import {
  HandleSave,
  HandleRaceChange,
} from '../../main/functions/editingLeaderboard';
import printLeaderboard from '../../main/functions/printLeaderboard';
import LatestHeats from '../../main/functions/LastestHeats'; // ensure LatestHeats is imported

function LeaderboardComponent({ eventId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);
  const [editMode, setEditMode] = useState(false); // Toggle for edit mode
  const [editableLeaderboard, setEditableLeaderboard] = useState([]); // Tracks editable leaderboard
  const [exportFormat, setExportFormat] = useState('excel'); // 'excel' | 'pdf' | 'html'
  const [editablePenalties, setEditablePenalties] = useState({});
  const [shiftPositions, setShiftPositions] = useState(false); // Tracks the state of the checkbox
  const [perRacePenaltyMode, setPerRacePenaltyMode] = useState(false);
  const [perRacePenalties, setPerRacePenalties] = useState({});
  const [swapMode, setSwapMode] = useState(false);
  // Each selected cell is recorded as an object: { boatId, raceIndex, raceId }
  const [selectedSwapCells, setSelectedSwapCells] = useState([]);

  const checkFinalSeriesStarted = useCallback(async () => {
    try {
      const heats =
        await window.electron.sqlite.heatRaceDB.readAllHeats(eventId);
      const finalHeats = heats.filter((heat) => heat.heat_type === 'Final');
      if (finalHeats.length > 0) {
        setFinalSeriesStarted(true);
      }
    } catch (error) {
      console.error('Error checking final series:', error);
    }
  }, [eventId]);

  useEffect(() => {
    checkFinalSeriesStarted();
  }, [checkFinalSeriesStarted]);

  const getFlagCode = (iocCode) => {
    return iocToFlagCodeMap[iocCode] || iocCode;
  };

  const fetchLeaderboard = useCallback(async () => {
    try {
      const [finalResults, eventResults] = await Promise.all([
        window.electron.sqlite.heatRaceDB.readFinalLeaderboard(eventId),
        window.electron.sqlite.heatRaceDB.readLeaderboard(eventId),
      ]);
      const results = finalSeriesStarted
        ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(eventId)
        : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);

      console.log('Fetched results:', results);

      const leaderboardWithRaces = results.map((entry) => {
        const races = entry.race_positions
          ? entry.race_positions.split(',')
          : [];
        const race_ids = entry.race_ids ? entry.race_ids.split(',') : [];

        // Calculate the number of worst places to exclude
        const number_of_races = races.length;
        let excludeCount = 0;
        if (number_of_races >= 4) {
          excludeCount = Math.floor((number_of_races - 4) / 4) + 1;
        }

        // Sort races in descending order to find the worst places
        const sortedRaces = [...races]
          .map((r) => parseInt(r, 10))
          .sort((a, b) => b - a);
        const worstPlaces = sortedRaces.slice(0, excludeCount);

        // Mark the worst places with parentheses
        let excludeCounter = 0;
        const markedRaces = races.map((race) => {
          const raceInt = parseInt(race, 10);
          if (worstPlaces.includes(raceInt) && excludeCounter < excludeCount) {
            excludeCounter += 1;
            worstPlaces.splice(worstPlaces.indexOf(raceInt), 1); // Remove the marked race from worstPlaces
            return `(${race})`;
          }
          return race;
        });

        return {
          ...entry,
          races: markedRaces,
          race_ids, // Ensure race_ids are included
        };
      });

      const combinedResults = finalResults.map((finalResult) => {
        const eventResult = eventResults.find(
          (result) => result.boat_id === finalResult.boat_id,
        );
        const total_points_final = finalResult.total_points_final || 0;
        const total_points_event = eventResult
          ? eventResult.total_points_event || 0
          : 0;
        const total_points_combined = total_points_final + total_points_event;
        return {
          ...finalResult,
          races: finalResult.race_positions
            ? finalResult.race_positions.split(',')
            : [],
          race_ids: finalResult.race_ids ? finalResult.race_ids.split(',') : [],
          total_points_combined,
        };
      });

      const mergedResults = leaderboardWithRaces.map((entry) => {
        const combinedEntry = combinedResults.find(
          (combined) => combined.boat_id === entry.boat_id,
        );
        return combinedEntry
          ? {
              ...entry,
              total_points_combined: combinedEntry.total_points_combined,
            }
          : entry;
      });

      mergedResults.sort((a, b) =>
        finalSeriesStarted
          ? a.total_points_combined - b.total_points_combined
          : a.total_points_event - b.total_points_event,
      );

      console.log('Combined leaderboard results:', mergedResults);
      setLeaderboard(mergedResults);
      setEditableLeaderboard(JSON.parse(JSON.stringify(mergedResults))); // Clone for editing
    } catch (error) {
      console.error('Error fetching leaderboard:', error.message);
    } finally {
      setLoading(false);
    }
  }, [eventId, finalSeriesStarted]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const toggleEditMode = () => {
    if (editMode) {
      // Discard changes if exiting edit mode
      setEditableLeaderboard(JSON.parse(JSON.stringify(leaderboard)));
    }
    setEditMode(!editMode);
  };

  // When entering edit mode, initialize penalties for each row.
  useEffect(() => {
    if (editMode && Array.isArray(editableLeaderboard)) {
      const penaltiesInit = {};
      editableLeaderboard.forEach((entry) => {
        // Initialize with an empty string or current penalty (if any)
        penaltiesInit[entry.boat_id] = entry.penalty || '';
      });
      setEditablePenalties(penaltiesInit);
    }
  }, [editMode, editableLeaderboard]);

  // When perRacePenaltyMode is toggled on, initialize per race penalties.
  useEffect(() => {
    if (editMode && perRacePenaltyMode) {
      const penalties = {};
      editableLeaderboard.forEach((entry) => {
        // Initialize an array of the same length as the number of race results.
        penalties[entry.boat_id] = entry.races.map(() => '');
      });
      setPerRacePenalties(penalties);
    }
  }, [editMode, perRacePenaltyMode, editableLeaderboard]);

  useEffect(() => {
    if (editMode && Array.isArray(editableLeaderboard)) {
      const penalties = {};
      editableLeaderboard.forEach((entry) => {
        // Set penalties array—with one element per race.
        penalties[entry.boat_id] = entry.races.map(() => '');
      });
      setPerRacePenalties(penalties);
    }
  }, [editMode, editableLeaderboard]);

  // Function to apply penalty updates similar to handleSubmit logic.
  // Function to apply penalty updates similar to handleSubmit logic.
  const applyPenaltyUpdates = async (boatId, raceIndex, penalty) => {
    // If any of the required parameters is missing, do nothing.
    if (
      typeof boatId === 'undefined' ||
      typeof raceIndex === 'undefined' ||
      !penalty
    ) {
      return;
    }

    try {
      const raceMapping =
        await window.electron.sqlite.heatRaceDB.getRaceMapping(eventId);
      const entry = editableLeaderboard.find(
        (e) => e.boat_id.toString() === boatId.toString(),
      );
      if (!entry) return;

      // Convert race_ids into an array.
      const raceIds =
        typeof entry.race_ids === 'string'
          ? entry.race_ids.split(',')
          : entry.race_ids;
      const raceId = raceIds[raceIndex];
      if (!raceId) return;

      // 1. Retrieve all heats for the event.
      const allHeats =
        await window.electron.sqlite.heatRaceDB.readAllHeats(eventId);
      // 2. Determine the latest heats using LatestHeats.
      const latestHeats = LatestHeats(allHeats);
      // 3. Ensure each latest heat has its boats loaded.
      await Promise.all(
        latestHeats.map(async (h) => {
          if (!h.boats || h.boats.length === 0) {
            try {
              const boats =
                await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
                  h.heat_id,
                );
              h.boats = boats;
            } catch (err) {
              console.error(
                `Error retrieving boats for heat ${h.heat_name}:`,
                err,
              );
              h.boats = [];
            }
          }
        }),
      );
      // 4. Get the maximum number of boats among the latest heats.
      const longestHeatCount = latestHeats.reduce((max, h) => {
        const count = h.boats ? h.boats.length : 0;
        return count > max ? count : max;
      }, 0);

      // 5. Determine newPosition based on penalty.
      let newPosition = longestHeatCount + 1;
      if (penalty === 'RDG') {
        // Call calculateAverageScores and pick the competitor's average.
        const averages = await window.electron.ipcRenderer.invoke(
          'calculateAverageScores',
          eventId,
        );
        const boatAverages = averages[boatId];
        if (boatAverages) {
          // Use avgPointsFinal if final series has started; otherwise avgPointsQualifying.
          if (finalSeriesStarted && boatAverages.avgPointsFinal !== null) {
            newPosition = Math.round(boatAverages.avgPointsFinal);
          } else if (boatAverages.avgPointsQualifying !== null) {
            newPosition = Math.round(boatAverages.avgPointsQualifying);
          }
        }
      }

      const heat_id = raceMapping[raceId] || null;

      // Call the updateRaceResult IPC using the calculated newPosition.
      await window.electron.ipcRenderer.invoke(
        'updateRaceResult',
        eventId, // event_id
        raceId, // race_id
        boatId, // boat_id
        newPosition, // new_position set according to penalty condition
        false, // shift_positions (no shifting)
        heat_id, // heat_id
        penalty, // new penalty value
      );

      // Update local state.
      setPerRacePenalties((prev) => {
        const updatedBoatPenalties = [...(prev[boatId] || [])];
        updatedBoatPenalties[raceIndex] = penalty;
        return { ...prev, [boatId]: updatedBoatPenalties };
      });
    } catch (error) {
      console.error('Error applying single penalty update:', error);
    }
  };

  // New function to handle cell selection in swap mode.
  const toggleSwapCell = (entry, raceIndex) => {
    // Get raceIds from the entry.
    const raceIds =
      typeof entry.race_ids === 'string'
        ? entry.race_ids.split(',')
        : entry.race_ids;
    const raceId = raceIds[raceIndex];
    // Build the cell object.
    const cell = { boatId: entry.boat_id, raceIndex, raceId };
    // Check if already selected.
    const exists = selectedSwapCells.find(
      (selected) =>
        selected.boatId.toString() === cell.boatId.toString() &&
        selected.raceIndex === cell.raceIndex,
    );
    if (exists) {
      // Unselect if already added.
      setSelectedSwapCells((prev) =>
        prev.filter(
          (selected) =>
            !(
              selected.boatId.toString() === cell.boatId.toString() &&
              selected.raceIndex === cell.raceIndex
            ),
        ),
      );
    } else {
      // Allow maximum two selections.
      if (selectedSwapCells.length < 2) {
        setSelectedSwapCells((prev) => [...prev, cell]);
      } else {
        alert('Maximum of two selections allowed.');
      }
    }
  };

  const handleSaveSwappedChanges = async () => {
    if (selectedSwapCells.length !== 2) {
      alert('Please select exactly two cells.');
      return;
    }
    // Check both cells belong to the same race.
    const [cell1, cell2] = selectedSwapCells;
    if (cell1.raceId !== cell2.raceId) {
      alert('Both cells must be from the same race.');
      return;
    }
    try {
      // Swap race results.
      await window.electron.ipcRenderer.invoke(
        'swapRaceResults',
        eventId,
        cell1.raceId,
        cell1.boatId,
        cell2.boatId,
      );
      // Conditionally update the leaderboard based on whether the final series has started.
      if (finalSeriesStarted) {
        await window.electron.ipcRenderer.invoke(
          'updateFinalLeaderboard',
          eventId,
        );
      } else {
        await window.electron.ipcRenderer.invoke(
          'updateEventLeaderboard',
          eventId,
        );
      }
      alert('Swap completed successfully.');
      setSelectedSwapCells([]);
      setSwapMode(false);
      fetchLeaderboard();
    } catch (error) {
      console.error('Swap failed:', error);
      alert('Swap failed. See console for details.');
    }
  };
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!leaderboard.length) {
    return <div>No results available for this event.</div>;
  }

  const groupedLeaderboard =
    editableLeaderboard?.reduce((acc, entry) => {
      const group = entry.placement_group || 'Overall scores';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(entry);
      return acc;
    }, {}) || {};

  const groupOrder = ['Gold', 'Silver', 'Bronze', 'Copper', 'Iron', 'Tin'];
  const sortedGroups = Object.keys(groupedLeaderboard).sort((a, b) => {
    // Create a regex that matches any of the group names
    const regex = new RegExp(groupOrder.join('|'), 'i');
    const extractGroup = (group) => {
      const match = group.match(regex);
      return match ? match[0] : group;
    };
    const aGroup = extractGroup(a);
    const bGroup = extractGroup(b);
    // Normalize to proper case to match the order array
    const normalize = (s) =>
      s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const indexA = groupOrder.indexOf(normalize(aGroup));
    const indexB = groupOrder.indexOf(normalize(bGroup));
    return indexA - indexB;
  });
  const handlePrintLeaderboard = async () => {
    try {
      await printLeaderboard(
        leaderboard,
        finalSeriesStarted,
        sortedGroups,
        groupedLeaderboard,
        eventId,
        exportFormat,
      );
    } catch (error) {
      console.error('Error printing leaderboard:', error);
    }
  };

  return (
    <div className="leaderboard">
      <h2>{finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}</h2>
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="exportFormat">Export as: </label>
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
        <button type="button" onClick={handlePrintLeaderboard}>
          Print Leaderboard
        </button>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <button
          type="button"
          onClick={toggleEditMode}
          title="Enter Edit Mode to manually adjust race scores and penalties. For sailing, update finish times to reflect real conditions and apply penalties if needed."
        >
          {editMode
            ? 'Exit Edit Mode (Discard Changes)'
            : 'Enter Edit Mode (Manual Adjustments)'}
        </button>
        {editMode && (
          <button
            type="button"
            onClick={() => {
              setSwapMode(!swapMode);
              setSelectedSwapCells([]); // Reset any previous selections
            }}
            style={{ marginLeft: '10px' }}
          >
            {swapMode ? 'Cancel Swap Mode' : 'Enable Swap Mode'}
          </button>
        )}
        {editMode && swapMode && (
          <div
            style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '16px' }}
          >
            Swap Mode is active: Click on a boat&apos;s race cell to select it.
            All cells from boats in the same heat are highlighted in light blue.
            Select exactly two cells (from the same heat) and then click
            &quot;Save Swapped Changes&quot;.
          </div>
        )}
        {editMode && !swapMode && (
          <div
            style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '16px' }}
          >
            Edit Mode is active: You can adjust race scores directly and select
            penalties using the dropdown menus next to each race.
          </div>
        )}
        {editMode && swapMode && selectedSwapCells.length === 2 && (
          <button
            type="button"
            onClick={handleSaveSwappedChanges}
            style={{ marginLeft: '10px' }}
          >
            Save Swapped Changes
          </button>
        )}
        {editMode && !swapMode && (
          <button
            type="button"
            onClick={async () => {
              await HandleSave({
                eventId,
                leaderboard,
                editableLeaderboard,
                setLeaderboard,
                setEditableLeaderboard,
                setEditMode,
                shiftPositions,
                finalSeriesStarted,
              });
              // After saving race positions, update any penalties.
              await applyPenaltyUpdates();
              // Force recalculation of leaderboard totals by calling the backend update
              await window.electron.ipcRenderer.invoke(
                'updateEventLeaderboard',
                eventId,
              );
              // Then fetch the refreshed leaderboard
              await fetchLeaderboard();
            }}
            style={{ marginLeft: '10px' }}
          >
            Save Changes
          </button>
        )}
      </div>
      {sortedGroups.map((group) => {
        // Determine how many races this group has.
        const groupRacesCount = Math.max(
          ...groupedLeaderboard[group].map((entry) => entry.races.length),
        );
        const groupHeader =
          !finalSeriesStarted && group === 'Overall scores'
            ? 'Overall scores'
            : `${group} Group`;
        return (
          <div key={`group-${group}`}>
            <h3>{groupHeader}</h3>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Sail Number</th>
                  <th>Boat Type</th>
                  {(() => {
                    const headers = [];
                    for (let j = 1; j <= groupRacesCount; j += 1) {
                      // Only add Race and Penalty headers
                      headers.push(<th key={`race-${j}`}>Race {j}</th>);
                      if (editMode && !swapMode) {
                        headers.push(
                          <th key={`penalty-${j}`}>Penalty Race {j}</th>,
                        );
                      }
                    }
                    return headers;
                  })()}
                  <th>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {groupedLeaderboard[group]?.map((entry, index) => (
                  <tr key={`boat-${entry.boat_id}`}>
                    <td>{index + 1}</td>
                    <td>
                      {entry.name} {entry.surname}
                    </td>
                    <td>
                      <Flag
                        code={getFlagCode(entry.country)}
                        style={{ width: '30px', marginRight: '5px' }}
                      />
                      {entry.country}
                    </td>
                    <td>{entry.boat_number}</td>
                    <td>{entry.boat_type}</td>
                    {Array.from({ length: groupRacesCount }).map(
                      (_, raceIndex) => {
                        // Compute cell's raceId from entry.race_ids (handle string or array)
                        const cellRaceId =
                          typeof entry.race_ids === 'string'
                            ? entry.race_ids.split(',')[raceIndex]
                            : entry.race_ids[raceIndex];
                        // Determine if this cell should be highlighted.
                        const isHighlighted =
                          swapMode &&
                          selectedSwapCells.some(
                            (cell) => cell.raceId === cellRaceId,
                          );

                        return (
                          <React.Fragment
                            key={`race-fragment-${entry.boat_id}-${cellRaceId}`}
                          >
                            <td
                              style={{
                                position: 'relative',
                                backgroundColor: (() => {
                                  if (isHighlighted) {
                                    return '#ADD8E6';
                                  }
                                  if (editMode) {
                                    return '#f9f9f9';
                                  }
                                  return 'transparent';
                                })(),
                              }}
                            >
                              {editMode ? (
                                <input
                                  type="number"
                                  value={
                                    typeof entry.races[raceIndex] === 'string'
                                      ? (entry.races[raceIndex].match(
                                          /\d+/,
                                        ) || [''])[0]
                                      : entry.races[raceIndex] || ''
                                  }
                                  onChange={(e) =>
                                    setEditableLeaderboard(
                                      HandleRaceChange({
                                        boatId: entry.boat_id,
                                        raceIndex,
                                        newHandleRaceChangeValue:
                                          e.target.value,
                                        editableLeaderboard,
                                        shiftPositions,
                                      }),
                                    )
                                  }
                                  style={{ width: '50px' }}
                                />
                              ) : (
                                entry.races[raceIndex] || ''
                              )}
                              {/* When swap mode is enabled, render a small interactive button */}
                              {editMode && swapMode && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleSwapCell(entry, raceIndex)
                                  }
                                  style={{
                                    position: 'absolute',
                                    right: '5px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '15px',
                                    height: '15px',
                                    border: '1px solid #000',
                                    backgroundColor: (() => {
                                      const isSelected =
                                        !!selectedSwapCells.find(
                                          (cell) =>
                                            cell.boatId.toString() ===
                                              entry.boat_id.toString() &&
                                            cell.raceIndex === raceIndex,
                                        );
                                      return isSelected ? '#cce5ff' : '#fff';
                                    })(),
                                    padding: 0,
                                    margin: 0,
                                    borderRadius: 0,
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    lineHeight: '15px',
                                    textAlign: 'center',
                                  }}
                                  aria-label="Select cell for swap"
                                >
                                  {selectedSwapCells.some(
                                    (cell) =>
                                      cell.boatId.toString() ===
                                        entry.boat_id.toString() &&
                                      cell.raceIndex === raceIndex,
                                  ) && (
                                    <span style={{ color: 'blue' }}>✔</span>
                                  )}
                                </button>
                              )}
                            </td>
                            {editMode && !swapMode && (
                              <td>
                                <select
                                  value={
                                    perRacePenalties[entry.boat_id] &&
                                    perRacePenalties[entry.boat_id][raceIndex]
                                      ? perRacePenalties[entry.boat_id][
                                          raceIndex
                                        ]
                                      : ''
                                  }
                                  onChange={(e) =>
                                    applyPenaltyUpdates(
                                      entry.boat_id,
                                      raceIndex,
                                      e.target.value,
                                    )
                                  }
                                  style={{ width: '80px' }}
                                >
                                  <option value="">None</option>
                                  <option value="DNS">DNS</option>
                                  <option value="DNF">DNF</option>
                                  <option value="RET">RET</option>
                                  <option value="NSC">NSC</option>
                                  <option value="OCS">OCS</option>
                                  <option value="DNC">DNC</option>
                                  <option value="WTH">WTH</option>
                                  <option value="UFD">UFD</option>
                                  <option value="BFD">BFD</option>
                                  <option value="DSQ">DSQ</option>
                                  <option value="DNE">DNE</option>
                                  <option value="RDG">RDG</option>
                                </select>
                              </td>
                            )}
                          </React.Fragment>
                        );
                      },
                    )}
                    <td>
                      {finalSeriesStarted
                        ? entry.total_points_combined
                        : entry.total_points_event}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

LeaderboardComponent.propTypes = {
  eventId: PropTypes.number.isRequired,
};

export default LeaderboardComponent;
