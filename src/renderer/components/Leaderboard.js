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

  const checkFinalSeriesStarted = useCallback(async () => {
    try {
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(eventId);
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
      } catch (error) {
        console.error('Error fetching leaderboard:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [eventId, finalSeriesStarted]);

  const toggleEditMode = () => {
    if (editMode) {
      // Discard changes if exiting edit mode
      setEditableLeaderboard(JSON.parse(JSON.stringify(leaderboard)));
    }
    setEditMode(!editMode);
  };

  const handleRaceChange = (boatId, raceIndex, value) => {
    if (!isNaN(value) && value >= 0) {
      const updatedLeaderboard = editableLeaderboard.map((entry) =>
        entry.boat_id === boatId
          ? {
              ...entry,
              races: entry.races.map((race, index) =>
                index === raceIndex ? value : race
              ),
              total_points_event: entry.races.reduce((acc, race, index) => acc + (index === raceIndex ? parseInt(value, 10) : parseInt(race, 10)), 0),
              total_points_final: entry.races.reduce((acc, race, index) => acc + (index === raceIndex ? parseInt(value, 10) : parseInt(race, 10)), 0),
            }
          : entry
      );
      setEditableLeaderboard(updatedLeaderboard);
    }
  };

  const handleSave = async () => {
    console.log('Updated leaderboard:', editableLeaderboard);
    try {
      if (!editableLeaderboard || !leaderboard) {
        throw new Error('Leaderboard data is not initialized');
      }

      // Update changes to the database
      for (const entry of editableLeaderboard) {
        const originalEntry = leaderboard.find((e) => e.boat_id === entry.boat_id);
        if (!originalEntry) continue;

        // Save race data changes to the database
        for (let i = 0; i < entry.races.length; i++) {
          if (entry.races[i] !== originalEntry.races[i]) {
            const race_id = entry.race_ids[i]; // Get the correct race_id
            if (!race_id) {
              console.error('Race ID is missing for entry:', entry);
              continue;
            }
            console.log(`Updating race result for race_id: ${race_id}, boat_id: ${entry.boat_id}, new_position: ${entry.races[i]}`);
            await window.electron.sqlite.heatRaceDB.updateRaceResult(
              race_id,
              entry.boat_id,
              entry.races[i],
              false, // Disable shift positions for inline edit
            );
          }
        }
      }

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

  const groupedLeaderboard = editableLeaderboard?.reduce((acc, entry) => {
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
      ...leaderboard[0]?.races?.map((_, index) => `Race ${index + 1}`) || [],
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
        <button onClick={toggleEditMode}>
          {editMode ? 'Cancel Edit Mode' : 'Enable Edit Mode'}
        </button>
        {editMode && (
          <button onClick={handleSave} style={{ marginLeft: '10px' }}>
            Save Changes
          </button>
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
    key={`entry-race-${entry.boat_id}-${raceIndex}`}
    style={{
      cursor: editMode ? 'pointer' : 'default',
      backgroundColor: editMode ? '#f9f9f9' : 'transparent',
    }}
  >
    {editMode ? (
      <input
        type="number"
        value={race}
        onChange={(e) =>
          handleRaceChange(entry.boat_id, raceIndex, e.target.value)
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
