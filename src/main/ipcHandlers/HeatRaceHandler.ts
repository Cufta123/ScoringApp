/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

console.log('HeatRaceHandler.ts loaded');

ipcMain.handle('readAllHeats', async (event, event_id) => {
  try {
    const heats = db
      .prepare('SELECT * FROM Heats WHERE event_id = ?')
      .all(event_id);
    return heats;
  } catch (error) {
    console.error('Error reading all heats:', error);
    throw error;
  }
});

ipcMain.handle('insertHeat', async (event, event_id, heat_name, heat_type) => {
  try {
    const result = db
      .prepare(
        'INSERT INTO Heats (event_id, heat_name, heat_type) VALUES (?, ?, ?)',
      )
      .run(event_id, heat_name, heat_type);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting heat:', error);
    throw error;
  }
});

ipcMain.handle('insertHeatBoat', async(event, heat_id, boat_id) => {
try {
  const result = db
    .prepare('INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)')
    .run(heat_id, boat_id);
  } catch (error) {
    console.error('Error inserting heat boat:', error);
    throw error;
  }
});
ipcMain.handle('deleteHeatsByEvent', async (event, event_id) => {
  try {
    const result = db
      .prepare('DELETE FROM Heat_Boat WHERE heat_id IN (SELECT heat_id FROM Heats WHERE event_id = ?)')
      .run(event_id);
    console.log(`Deleted ${result.changes} row(s) from HeatBoats for event ID ${event_id}.`);

    const resultHeats = db
      .prepare('DELETE FROM Heats WHERE event_id = ?')
      .run(event_id);
    console.log(`Deleted ${resultHeats.changes} row(s) from Heats for event ID ${event_id}.`);

    return { heatBoatsChanges: result.changes, heatsChanges: resultHeats.changes };
  } catch (error) {
    console.error('Error deleting heats by event:', error);
    throw error;
  }
});
ipcMain.handle('readBoatsByHeat', async (event, heat_id) => {
  try {
    const boats = db
      .prepare(`
        SELECT b.boat_id, b.sail_number, b.country, b.model, s.name, s.surname
        FROM Heat_Boat hb
        JOIN Boats b ON hb.boat_id = b.boat_id
        JOIN Sailors s ON b.sailor_id = s.sailor_id
        WHERE hb.heat_id = ?
      `)
      .all(heat_id);
    return boats;
  } catch (error) {
    console.error('Error reading boats by heat:', error);
    throw error;
  }
});
ipcMain.handle('readAllRaces', async (event, heat_id) => {
  try {
    const races = db
      .prepare('SELECT * FROM Races WHERE heat_id = ?')
      .all(heat_id);
    return races;
  } catch (error) {
    console.error('Error reading all races:', error);
    throw error;
  }
});

ipcMain.handle('insertRace', async (event, heat_id, race_number) => {
  try {
    const result = db
      .prepare('INSERT INTO Races (heat_id, race_number) VALUES (?, ?)')
      .run(heat_id, race_number);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting race:', error);
    throw error;
  }
});

ipcMain.handle('readAllScores', async (event, race_id) => {
  try {
    const scores = db
      .prepare('SELECT * FROM Scores WHERE race_id = ?')
      .all(race_id);
    return scores;
  } catch (error) {
    console.error('Error reading all scores:', error);
    throw error;
  }
});

ipcMain.handle(
  'insertScore',
  async (event, race_id, boat_id, position, points, status) => {
    try {
      const result = db
        .prepare(
          'INSERT INTO Scores (race_id, boat_id, position, points, status) VALUES (?, ?, ?, ?, ?)',
        )
        .run(race_id, boat_id, position, points, status);
      return { lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      console.error('Error inserting score:', error);
      throw error;
    }
  },
);

ipcMain.handle(
  'updateScore',
  async (event, score_id, position, points, status) => {
    try {
      const result = db
        .prepare(
          'UPDATE Scores SET position = ?, points = ?, status = ? WHERE score_id = ?',
        )
        .run(position, points, status, score_id);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error updating score:', error);
      throw error;
    }
  },
);

ipcMain.handle('updateEventLeaderboard', async (event, event_id) => {
  try {
    const query = `
      SELECT boat_id, SUM(points) as total_points_event
      FROM Scores
      JOIN Races ON Scores.race_id = Races.race_id
      JOIN Heats ON Races.heat_id = Heats.heat_id
      WHERE Heats.event_id = ?
      GROUP BY boat_id
      ORDER BY total_points_event ASC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id);

    const updateQuery = db.prepare(
      `INSERT INTO Leaderboard (boat_id, total_points_event, event_id)
       VALUES (?, ?, ?)
       ON CONFLICT(boat_id, event_id) DO UPDATE SET total_points_event = excluded.total_points_event`
    );

    results.forEach((result: { boat_id: any; total_points_event: any; }) => {
      updateQuery.run(result.boat_id, result.total_points_event, event_id);
    });

    console.log('Event leaderboard updated successfully.');
    return { success: true };
  } catch (error) {
    console.error('Error updating event leaderboard:', (error as Error).message);
    throw error;
  }
});


ipcMain.handle('updateGlobalLeaderboard', async (event, event_id) => {
  try {
    const query = `
      SELECT boat_id, RANK() OVER (ORDER BY total_points_event ASC) as final_position
      FROM Leaderboard
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all();

    const updateQuery = db.prepare(
      `INSERT INTO GlobalLeaderboard (boat_id, total_points_global)
       VALUES (?, ?)
       ON CONFLICT(boat_id) DO UPDATE SET total_points_global = total_points_global + excluded.total_points_global`
    );

    results.forEach((result: { boat_id: any; final_position: any; }) => {
      updateQuery.run(result.boat_id, result.final_position);
    });

    console.log('Global leaderboard updated successfully.');
    return { success: true };
  } catch (error) {
    console.error('Error updating global leaderboard:', error);
    throw error;
  }
});

ipcMain.handle('deleteScore', async (event, score_id) => {
  try {
    const result = db
      .prepare('DELETE FROM Scores WHERE score_id = ?')
      .run(score_id);
    return { changes: result.changes };
  } catch (error) {
    console.error('Error deleting score:', error);
    throw error;
  }
});

ipcMain.handle('createNewHeatsBasedOnLeaderboard', async (event, event_id) => {
  try {
    // Read the current leaderboard for the specific event
    const leaderboardQuery = `
      SELECT boat_id
      FROM Leaderboard
      WHERE event_id = ?
      ORDER BY total_points_event ASC
    `;
    const readLeaderboardQuery = db.prepare(leaderboardQuery);
    const leaderboardResults = readLeaderboardQuery.all(event_id);

    // Read the existing heats for the event
    const existingHeatsQuery = db.prepare(
      `SELECT heat_name, heat_id FROM Heats WHERE event_id = ?`
    );
    const existingHeats = existingHeatsQuery.all(event_id);

    // Check race count for each heat
    const heatRaceCounts: { [key: string]: number } = {};
    const raceCountQuery = db.prepare(
      `SELECT COUNT(*) as race_count FROM Races WHERE heat_id = ?`
    );

    for (const heat of existingHeats) {
      const raceCount = raceCountQuery.get(heat.heat_id).race_count;
      heatRaceCounts[heat.heat_name] = raceCount;
    }

    // Validate that all heats have the same number of races
    const raceCounts = Object.values(heatRaceCounts);
    const uniqueRaceCounts = [...new Set(raceCounts)];

    if (uniqueRaceCounts.length > 1) {
      console.error('Heats do not have the same number of races.');
      return { success: false, message: 'All heats must have the same number of races before creating new heats.' };
    }

    // Group existing heats by base name (A, B, etc.) and track their maximum suffix
    const heatSuffixMap: { [key: string]: number } = {};
    existingHeats.forEach((heat: { heat_name: string }) => {
      const { heat_name } = heat;
      const match = heat_name.match(/Heat ([A-Z]+)(\d*)/);
      if (match) {
        const [_, base, suffix] = match;
        const numericSuffix = suffix ? parseInt(suffix, 10) : 0;
        if (!heatSuffixMap[base] || numericSuffix > heatSuffixMap[base]) {
          heatSuffixMap[base] = numericSuffix;
        }
      }
    });

    // Determine the next round of heats
    const numBaseHeats = Object.keys(heatSuffixMap).length || 2; // Default to A, B if no heats exist
    const nextHeatNames = [];
    for (let i = 0; i < numBaseHeats; i++) {
      const base = String.fromCharCode(65 + i); // A, B, C, ...
      const nextSuffix = (heatSuffixMap[base] || 0) + 1;
      nextHeatNames.push(`Heat ${base}${nextSuffix}`);
    }

    // Create new heats and assign boats to them
    for (let i = 0; i < nextHeatNames.length; i++) {
      const heatName = nextHeatNames[i];
      const heatType = 'Qualifying';

      // Insert the new heat into the database
      const { lastInsertRowid: newHeatId } = db
        .prepare('INSERT INTO Heats (event_id, heat_name, heat_type) VALUES (?, ?, ?)')
        .run(event_id, heatName, heatType);

      // Assign boats to the new heat
      for (let j = i; j < leaderboardResults.length; j += nextHeatNames.length) {
        const boatId = leaderboardResults[j].boat_id;
        db.prepare('INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)')
          .run(newHeatId, boatId);
      }
    }

    console.log('New heats created based on leaderboard.');
    return { success: true };
  } catch (error) {
    console.error('Error creating new heats based on leaderboard:', (error as Error).message);
    throw error;
  }
});

