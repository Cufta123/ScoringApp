import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

function LeaderboardComponent({ eventId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalSeriesStarted, setFinalSeriesStarted] = useState(false);

  const checkFinalSeriesStarted = useCallback(async () => {
    try {
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(eventId);
      const finalHeats = heats.filter(heat => heat.heat_type === 'Final');
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

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const results = finalSeriesStarted
          ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(eventId)
          : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);
        console.log('Fetched leaderboard:', results);

        const leaderboardWithRaces = results.map(entry => ({
          ...entry,
          races: entry.race_positions ? entry.race_positions.split(',') : [],
        }));

        // Sort the leaderboard by total_points_event or total_points_final in ascending order
        leaderboardWithRaces.sort(
          (a, b) => (finalSeriesStarted ? a.total_points_final - b.total_points_final : a.total_points_event - b.total_points_event),
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

  return (
    <div className="leaderboard">
      <h2>{finalSeriesStarted ? 'Final Leaderboard' : 'Leaderboard'}</h2>
      {sortedGroups.map(group => (
        <div key={group}>
          <h3>{group} Group</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Boat Number</th>
                <th>Boat Type</th>
                <th>Country</th>
                {leaderboard[0].races.map((_, index) => (
                  <th key={index}>Race {index + 1}</th>
                ))}
                <th>Total Points</th>
              </tr>
            </thead>
            <tbody>
              {groupedLeaderboard[group].map((entry, index) => (
                <tr key={entry.boat_id}>
                  <td>{index + 1}</td>
                  <td>{entry.name} {entry.surname}</td>
                  <td>{entry.boat_number}</td>
                  <td>{entry.boat_type}</td>
                  <td>{entry.country}</td>
                  {entry.races.map((race, raceIndex) => (
                    <td key={raceIndex}>{race}</td>
                  ))}
                  <td>{finalSeriesStarted ? entry.total_points_final : entry.total_points_event}</td>
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
