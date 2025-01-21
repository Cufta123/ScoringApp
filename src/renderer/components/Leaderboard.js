/* eslint-disable camelcase */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import Flag from 'react-world-flags';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import iocToFlagCodeMap from '../constants/iocToFlagCodeMap';

function LeaderboardComponent({ eventId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // Tracks the row and cell being edited
  const [newValue, setNewValue] = useState(''); // Stores the new value for the cell being edited
  const [editMode, setEditMode] = useState(false); // Toggle for edit mode
  const [editableLeaderboard, setEditableLeaderboard] = useState([]); // Tracks editable leaderboard
  const [shiftPositions, setShiftPositions] = useState(false); // Tracks the state of the checkbox

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
          .map((r) => parseInt(r))
          .sort((a, b) => b - a);
        const worstPlaces = sortedRaces.slice(0, excludeCount);

        // Mark the worst places with parentheses
        let excludeCounter = 0;
        const markedRaces = races.map((race) => {
          const raceInt = parseInt(race);
          if (worstPlaces.includes(raceInt) && excludeCounter < excludeCount) {
            excludeCounter++;
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

      leaderboardWithRaces.sort((a, b) =>
        finalSeriesStarted
          ? a.total_points_final - b.total_points_final
          : a.total_points_event - b.total_points_event,
      );

      setLeaderboard(leaderboardWithRaces);
      setEditableLeaderboard(JSON.parse(JSON.stringify(leaderboardWithRaces))); // Clone for editing
    } catch (error) {
      console.error('Error fetching leaderboard:', error.message);
    } finally {
      setLoading(false);
    }
  }, [eventId, finalSeriesStarted]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

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

  const handleRaceChange = (boatId, raceIndex, newValue) => {
    if (!Number.isNaN(Number(newValue)) && newValue >= 0) {
      const updatedLeaderboard = editableLeaderboard.map((entry) => {
        if (entry.boat_id === boatId) {
          const oldPosition = parseInt(entry.races[raceIndex], 10);
          const newPosition = parseInt(newValue, 10);
          const heatId =
            entry.heat_ids && entry.heat_ids[raceIndex]
              ? entry.heat_ids[raceIndex]
              : null;

          // Update the position of the selected boat
          entry.races[raceIndex] = newPosition;

          if (shiftPositions) {
            // Shift positions of other boats in the same race within the same heat
            editableLeaderboard.forEach((otherEntry) => {
              if (
                otherEntry.boat_id !== boatId &&
                otherEntry.races[raceIndex] !== undefined
              ) {
                const otherPosition = parseInt(otherEntry.races[raceIndex], 10);
                if (
                  oldPosition > newPosition &&
                  otherPosition >= newPosition &&
                  otherPosition < oldPosition
                ) {
                  otherEntry.races[raceIndex] = otherPosition + 1;
                } else if (
                  oldPosition < newPosition &&
                  otherPosition <= newPosition &&
                  otherPosition > oldPosition
                ) {
                  otherEntry.races[raceIndex] = otherPosition - 1;
                }
              }
            });
          }

          const totalPointsEvent = entry.races.reduce(
            (acc, race) => acc + parseInt(race, 10),
            0,
          );
          const totalPointsFinal = totalPointsEvent;

          return {
            ...entry,
            total_points_event: totalPointsEvent,
            total_points_final: totalPointsFinal,
            heat_id: heatId, // Include heat_id in the entry
          };
        }
        return entry;
      });

      // Recalculate total points for all boats after shifting positions
      const recalculatedLeaderboard = updatedLeaderboard.map((entry) => {
        const totalPointsEvent = entry.races.reduce(
          (acc, race) => acc + parseInt(race, 10),
          0,
        );
        const totalPointsFinal = totalPointsEvent;

        return {
          ...entry,
          total_points_event: totalPointsEvent,
          total_points_final: totalPointsFinal,
        };
      });

      setEditableLeaderboard(recalculatedLeaderboard);
    }
  };
  const handleSave = async () => {
    console.log('Updated leaderboard:', editableLeaderboard);
    try {
      if (!editableLeaderboard || !leaderboard) {
        throw new Error('Leaderboard data is not initialized');
      }

      // Recalculate total points before saving
      const updatedLeaderboard = editableLeaderboard.map((entry) => {
        // Calculate total points based on updated races
        const totalPointsEvent = entry.races.reduce(
          (acc, race) => acc + parseInt(race, 10),
          0,
        );
        const totalPointsFinal = totalPointsEvent; // Use the same logic for final points if needed

        return {
          ...entry,
          total_points_event: totalPointsEvent,
          total_points_final: totalPointsFinal,
        };
      });

      // Update changes to the database
      const updatePromises = updatedLeaderboard.map(async (entry) => {
        const originalEntry = leaderboard.find(
          (e) => e.boat_id === entry.boat_id,
        );
        if (originalEntry) {
          // Save race data changes to the database
          const racePromises = entry.races.map(async (race, i) => {
            if (race !== originalEntry.races[i]) {
              const race_id = entry.race_ids[i]; // Get the correct race_id
              const { heat_id } = entry; // Get the heat_id
              if (!race_id) {
                return; // Skip if race_id is missing
              }
              const newPosition = parseInt(race, 10); // Ensure new_position is a number
              if (Number.isNaN(newPosition)) {
                console.error(`Invalid race position: ${race}`);
                return;
              }
              await window.electron.sqlite.heatRaceDB.updateRaceResult(
                eventId, // Pass event_id
                race_id,
                entry.boat_id,
                newPosition, // Pass new_position as a number
                shiftPositions, // Use the checkbox state to determine if positions should be shifted
                heat_id, // Pass heat_id
              );
            }
          });
          await Promise.all(racePromises);
        }
      });

      await Promise.all(updatePromises);

      // Refresh the leaderboard with the updated data after saving
      const results = finalSeriesStarted
        ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(eventId)
        : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);

      const leaderboardWithRaces = results.map((entry) => ({
        ...entry,
        races: entry.race_positions ? entry.race_positions.split(',') : [],
        race_ids: entry.race_ids ? entry.race_ids.split(',') : [], // Ensure race_ids are included
      }));

      leaderboardWithRaces.sort((a, b) =>
        finalSeriesStarted
          ? a.total_points_final - b.total_points_final
          : a.total_points_event - b.total_points_event,
      );

      setLeaderboard(leaderboardWithRaces);
      setEditableLeaderboard(JSON.parse(JSON.stringify(leaderboardWithRaces))); // Clone for editing
      setEditMode(false); // Exit edit mode after saving
    } catch (error) {
      console.error('Error saving leaderboard:', error.message);
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
      const group = entry.placement_group || 'General';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(entry);
      return acc;
    }, {}) || {};

  const groupOrder = ['Gold', 'Silver', 'Bronze', 'Copper', 'General'];
  const sortedGroups = Object.keys(groupedLeaderboard).sort(
    (a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b),
  );

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaderboard');

    const header = [
      'Rank',
      'Name',
      'Country',
      'Boat Number',
      'Boat Type',
      ...(leaderboard[0]?.races?.map((_, index) => `Race ${index + 1}`) || []),
      'Total Points',
    ];
    worksheet.addRow(header);

    if (finalSeriesStarted) {
      sortedGroups.forEach((group) => {
        const groupHeader = [`${group} Group`];
        worksheet.addRow(groupHeader);

        groupedLeaderboard[group]?.forEach((entry, index) => {
          const row = [
            index + 1,
            `${entry.name} ${entry.surname}`,
            entry.country,
            entry.boat_number,
            entry.boat_type,
            ...entry.races,
            entry.total_points_final,
          ];
          worksheet.addRow(row);
        });
      });
    } else {
      leaderboard.forEach((entry, index) => {
        const row = [
          index + 1,
          `${entry.name} ${entry.surname}`,
          entry.country,
          entry.boat_number,
          entry.boat_type,
          ...entry.races,
          entry.total_points_event,
        ];
        worksheet.addRow(row);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, 'leaderboard.xlsx');
  };

  return (
    <div className="leaderboard">
      <h2>{finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}</h2>
      <button type="button" onClick={exportToExcel}>
        Export to Excel
      </button>
      <div>
        <button type="button" onClick={toggleEditMode}>
          {editMode ? 'Cancel Edit Mode' : 'Enable Edit Mode'}
        </button>
        {editMode && (
          <div>
            <button
              type="button"
              onClick={handleSave}
              style={{ marginLeft: '10px' }}
            >
              Save Changes
            </button>
            <label
              htmlFor="shiftPositionsCheckbox"
              style={{ marginLeft: '10px' }}
            >
              <input
                id="shiftPositionsCheckbox"
                type="checkbox"
                checked={shiftPositions}
                onChange={(e) => setShiftPositions(e.target.checked)}
              />
              Shift positions of other boats
            </label>
          </div>
        )}
      </div>
      {sortedGroups.map((group) => (
        <div key={`group-${group}`}>
          <h3>{group} Group</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Country</th>
                <th>Boat Number</th>
                <th>Boat Type</th>
                {leaderboard[0]?.races?.map((_, index) => (
                  <th key={`header-race-${index}`}>Race {index + 1}</th>
                )) || []}
                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {groupedLeaderboard[group]?.map((entry, index) => (
                <tr key={`boat-${entry.boat_id}-${index}`}>
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
                  {entry.races?.map((race, raceIndex) => (
                    <td
                      key={`entry-race-${entry.boat_id}-${entry.race_ids[raceIndex]}`}
                      style={{
                        cursor: editMode ? 'pointer' : 'default',
                        backgroundColor: editMode ? '#f9f9f9' : 'transparent',
                      }}
                    >
                      {editMode ? (
                        <input
                          type="number"
                          value={
                            typeof race === 'string'
                              ? race.replace(/[()]/g, '')
                              : race
                          } // Remove parentheses for editing
                          onChange={(e) =>
                            handleRaceChange(
                              entry.boat_id,
                              raceIndex,
                              e.target.value,
                            )
                          }
                          style={{ width: '50px' }}
                        />
                      ) : (
                        race
                      )}
                    </td>
                  ))}
                  <td>
                    {finalSeriesStarted
                      ? entry.total_points_final
                      : entry.total_points_event}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

LeaderboardComponent.propTypes = {
  eventId: PropTypes.number.isRequired,
};

export default LeaderboardComponent;
