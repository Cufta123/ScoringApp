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
  const [editingEntry, setEditingEntry] = useState(null);
  const [newPosition, setNewPosition] = useState('');
  const [shiftPositions, setShiftPositions] = useState(false);

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

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const results = finalSeriesStarted
          ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(
              eventId,
            )
          : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);
        console.log('Fetched leaderboard:', results);

        const leaderboardWithRaces = results.map((entry) => ({
          ...entry,
          races: entry.race_positions ? entry.race_positions.split(',') : [],
        }));

        // Sort the leaderboard by total_points_event or total_points_final in ascending order
        leaderboardWithRaces.sort((a, b) =>
          finalSeriesStarted
            ? a.total_points_final - b.total_points_final
            : a.total_points_event - b.total_points_event,
        );

        setLeaderboard(leaderboardWithRaces);
      } catch (error) {
        console.error('Error fetching leaderboard:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [eventId, finalSeriesStarted]);

  const updateRaceResult = async (
    race_id,
    boat_id,
    new_position,
    shift_positions,
  ) => {
    try {
      const result = await window.electron.sqlite.heatRaceDB.updateRaceResult(
        race_id,
        boat_id,
        new_position,
        shift_positions,
      );
      if (result.success) {
        // Refresh the leaderboard after updating the race result
        const results = finalSeriesStarted
          ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(
              eventId,
            )
          : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);
        setLeaderboard(results);
      }
    } catch (error) {
      console.error('Error updating race result:', error);
    }
  };

  const handleEditResult = (entry) => {
    setEditingEntry(entry);
    setNewPosition(entry.position);
    setShiftPositions(false);
  };

  const handleSaveResult = () => {
    if (editingEntry) {
      updateRaceResult(
        editingEntry.race_id,
        editingEntry.boat_id,
        newPosition,
        shiftPositions,
      );
      setEditingEntry(null);
      setNewPosition('');
      setShiftPositions(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!leaderboard.length) {
    return <div>No results available for this event.</div>;
  }

  const groupedLeaderboard = leaderboard.reduce((acc, entry) => {
    const group = entry.placement_group || 'General';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(entry);
    return acc;
  }, {});

  const groupOrder = ['Gold', 'Silver', 'Bronze', 'Copper', 'General'];
  const sortedGroups = Object.keys(groupedLeaderboard).sort((a, b) => {
    return groupOrder.indexOf(a) - groupOrder.indexOf(b);
  });

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaderboard');

    // Add header row
    const header = [
      'Rank',
      'Name',
      'Country',
      'Boat Number',
      'Boat Type',
      ...leaderboard[0].races.map((_, index) => `Race ${index + 1}`),
      'Total Points',
    ];
    worksheet.addRow(header);

    // Add data rows
    if (finalSeriesStarted) {
      sortedGroups.forEach((group) => {
        const groupHeader = [`${group} Group`];
        worksheet.addRow(groupHeader);

        groupedLeaderboard[group].forEach((entry, index) => {
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

    // Generate Excel file and trigger download
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
                {leaderboard[0].races.map((race, index) => (
                  <th key={`header-race-${index}`}>Race {index + 1}</th>
                ))}

                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {groupedLeaderboard[group].map((entry, index) => (
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

                  {entry.races.map((race, raceIndex) => (
                    <td key={`entry-race-${entry.boat_id}-${raceIndex}`}>
                      {race}
                    </td>
                  ))}
                  <td>
                    {finalSeriesStarted
                      ? entry.total_points_final
                      : entry.total_points_event}
                  </td>
                  <td>
                    {editingEntry && editingEntry.boat_id === entry.boat_id ? (
                      <>
                        <input
                          type="number"
                          value={newPosition}
                          onChange={(e) => setNewPosition(e.target.value)}
                        />
                        <label htmlFor="shift-positions-checkbox">
                          Shift positions?
                        </label>
                        <input
                          id="shift-positions-checkbox"
                          type="checkbox"
                          checked={shiftPositions}
                          onChange={(e) => setShiftPositions(e.target.checked)}
                        />
                        <button type="button" onClick={handleSaveResult}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEditResult(entry)}
                      >
                        Edit Result
                      </button>
                    )}
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
