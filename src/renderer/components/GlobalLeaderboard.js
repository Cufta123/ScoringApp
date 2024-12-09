/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';

function GlobalLeaderboardComponent() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalLeaderboard = async () => {
      try {
        const results =
          await window.electron.sqlite.heatRaceDB.readGlobalLeaderboard();
        console.log('Fetched global leaderboard:', results);

        const mappedLeaderboard = results.map((entry) => ({
          ...entry,
          sailor: `${entry.name} ${entry.surname}`,
          club: entry.club_name, // Map club_name
          country: entry.country, // Map country
          category: entry.category_name, // Map category_name
        }));

        // Sort the leaderboard by total_points in descending order
        mappedLeaderboard.sort((a, b) => a.total_points - b.total_points);

        setLeaderboard(mappedLeaderboard);
      } catch (error) {
        console.error('Error fetching global leaderboard:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalLeaderboard();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!leaderboard.length) {
    return <div>No results available.</div>;
  }

  return (
    <div className="leaderboard">
      <h2>Global Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Surname</th>
            <th>Boat Number</th>
            <th>Boat Type</th>
            <th>Country</th>
            <th>Total Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry, index) => (
            <tr key={entry.boat_id}>
              <td>{index + 1}</td>
              <td>{entry.name}</td>
              <td>{entry.surname}</td>
              <td>{entry.boat_number}</td>
              <td>{entry.boat_type}</td>
              <td>{entry.country}</td>
              <td>{entry.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GlobalLeaderboardComponent;
