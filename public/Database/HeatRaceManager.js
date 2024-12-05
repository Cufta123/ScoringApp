/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath =
  process.env.NODE_ENV === 'development'
    ? './data/scoring_app.db'
    : path.join(process.resourcesPath, './data/scoring_app.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const readAllHeats = (event_id) => {
  try {
    const query = `
      SELECT
        heat_id, event_id, heat_name, heat_type
      FROM Heats
      WHERE event_id = ?
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id);
    console.log('Raw results from readAllHeats:', results); // Log the raw results
    return results;
  } catch (err) {
    console.error('Error reading all heats from the database:', err.message);
    return [];
  }
};
const readBoatsByHeat = (heat_id) => {
  try {
    const query = `
      SELECT b.boat_id, b.sail_number, b.country, b.model, s.name, s.surname
      FROM HeatBoats hb
      JOIN Boats b ON hb.boat_id = b.boat_id
      JOIN Sailors s ON b.sailor_id = s.sailor_id
      WHERE hb.heat_id = ?
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(heat_id);
    console.log('Raw results from readBoatsByHeat:', results); // Log the raw results
    return results;
  } catch (err) {
    console.error('Error reading boats by heat from the database:', err.message);
    return [];
  }
};
const insertHeat = (event_id, heat_name, heat_type) => {
  try {
    const insertQuery = db.prepare(
      `INSERT INTO Heats (event_id, heat_name, heat_type)
       VALUES (?, ?, ?)`,
    );
    const info = insertQuery.run(event_id, heat_name, heat_type);
    console.log(
      `Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Heats.`,
    );
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error('Error inserting heat into the database:', err.message);
    throw err;
  }
};

const updateEventLeaderboard = (event_id) => {
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
      `INSERT INTO Leaderboard (boat_id, total_points_event)
       VALUES (?, ?)
       ON CONFLICT(boat_id) DO UPDATE SET total_points_event = excluded.total_points_event`
    );

    results.forEach(result => {
      updateQuery.run(result.boat_id, result.total_points_event);
    });

    console.log('Event leaderboard updated successfully.');
  } catch (err) {
    console.error('Error updating event leaderboard:', err.message);
    throw err;
  }
};

const updateGlobalLeaderboard = (event_id) => {
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

    results.forEach(result => {
      updateQuery.run(result.boat_id, result.final_position);
    });

    console.log('Global leaderboard updated successfully.');
  } catch (err) {
    console.error('Error updating global leaderboard:', err.message);
    throw err;
  }
};

const deleteHeatsByEvent = (event_id) => {
  try {
    // Delete associated HeatBoats entries first
    const deleteHeatBoatsQuery = db.prepare(
      `DELETE FROM HeatBoats WHERE heat_id IN (SELECT heat_id FROM Heats WHERE event_id = ?)`
    );
    const heatBoatsInfo = deleteHeatBoatsQuery.run(event_id);
    console.log(
      `Deleted ${heatBoatsInfo.changes} row(s) from HeatBoats for event ID ${event_id}.`
    );

    // Delete Heats entries
    const deleteHeatsQuery = db.prepare(
      `DELETE FROM Heats WHERE event_id = ?`
    );
    const heatsInfo = deleteHeatsQuery.run(event_id);
    console.log(
      `Deleted ${heatsInfo.changes} row(s) from Heats for event ID ${event_id}.`
    );

    return { heatBoatsChanges: heatBoatsInfo.changes, heatsChanges: heatsInfo.changes };
  } catch (err) {
    console.error('Error deleting heats and heat boats from the database:', err.message);
    throw err;
  }
};
const insertHeatBoat = (heat_id, boat_id) => {
  try {
    const insertQuery = db.prepare(
      `INSERT INTO HeatBoats (heat_id, boat_id)
       VALUES (?, ?)`,
    );
    const info = insertQuery.run(heat_id, boat_id);
    console.log(
      `Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into HeatBoats.`,
    );
    return { lastInsertRowid: info.lastInsertRowid };
  }
};
const readAllRaces = (heat_id) => {
  try {
    const query = `
      SELECT
        race_id, heat_id, race_number
      FROM Races
      WHERE heat_id = ?
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(heat_id);
    console.log('Raw results from readAllRaces:', results); // Log the raw results
    return results;
  } catch (err) {
    console.error('Error reading all races from the database:', err.message);
    return [];
  }
};

const insertRace = (heat_id, race_number) => {
  try {
    const insertQuery = db.prepare(
      `INSERT INTO Races (heat_id, race_number)
       VALUES (?, ?)`,
    );
    const info = insertQuery.run(heat_id, race_number);
    console.log(
      `Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Races.`,
    );
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error('Error inserting race into the database:', err.message);
    throw err;
  }
};

const readAllScores = (race_id) => {
  try {
    const query = `
      SELECT
        score_id, race_id, boat_id, position, points, status
      FROM Scores
      WHERE race_id = ?
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(race_id);
    console.log('Raw results from readAllScores:', results); // Log the raw results
    return results;
  } catch (err) {
    console.error('Error reading all scores from the database:', err.message);
    return [];
  }
};

const insertScore = (race_id, boat_id, position, points, status) => {
  try {
    const insertQuery = db.prepare(
      `INSERT INTO Scores (race_id, boat_id, position, points, status)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const info = insertQuery.run(race_id, boat_id, position, points, status);
    console.log(
      `Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Scores.`,
    );
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error('Error inserting score into the database:', err.message);
    throw err;
  }
};

const updateScore = (score_id, position, points, status) => {
  try {
    const updateQuery = db.prepare(
      `UPDATE Scores
       SET position = ?, points = ?, status = ?
       WHERE score_id = ?`,
    );
    const info = updateQuery.run(position, points, status, score_id);
    console.log(
      `Updated ${info.changes} row(s) with ID ${score_id} in Scores.`,
    );
    return { changes: info.changes };
  } catch (err) {
    console.error('Error updating score in the database:', err.message);
    throw err;
  }
};

const deleteScore = (score_id) => {
  try {
    const deleteQuery = db.prepare(
      `DELETE FROM Scores
       WHERE score_id = ?`,
    );
    const info = deleteQuery.run(score_id);
    console.log(
      `Deleted ${info.changes} row(s) with ID ${score_id} from Scores.`,
    );
    return { changes: info.changes };
  } catch (err) {
    console.error('Error deleting score from the database:', err.message);
    throw err;
  }
};
const createNewHeatsBasedOnLeaderboard = (event_id) => {
  try {
    // Read the current leaderboard
    const leaderboardQuery = `
      SELECT boat_id
      FROM Leaderboard
      ORDER BY total_points_event ASC
    `;
    const readLeaderboardQuery = db.prepare(leaderboardQuery);
    const leaderboardResults = readLeaderboardQuery.all();

    // Read the existing heats to determine the next heat name
    const existingHeatsQuery = db.prepare(
      `SELECT heat_name FROM Heats WHERE event_id = ?`
    );
    const existingHeats = existingHeatsQuery.all(event_id);

    // Determine the number of new heats to create based on the existing heats
    const numHeats = existingHeats.length || 2; // Default to 2 if no existing heats

    // Filter the existing heats to only include the most recent heats
    const recentHeats = existingHeats.filter((heat) => {
      const match = heat.heat_name.match(/Heat ([A-Z]+)(\d*)/);
      if (match) {
        const [, base, suffix] = match;
        return suffix === '' || suffix === '1';
      }
      return false;
    });

    // Determine the next heat names
    const heatNames = [];
    for (let i = 0; i < numHeats; i++) {
      const baseHeatName = `Heat ${String.fromCharCode(65 + i)}`; // A, B, C, ...
      let suffix = 1;
      let newHeatName = `${baseHeatName}${suffix}`;
      while (recentHeats.some((heat) => heat.heat_name === newHeatName)) {
        suffix++;
        newHeatName = `${baseHeatName}${suffix}`;
      }
      heatNames.push(newHeatName);
    }

    // Create new heats based on the leaderboard
    for (let i = 0; i < numHeats; i++) {
      const heatName = heatNames[i];
      const heatType = 'Qualifying';
      const { lastInsertRowid: newHeatId } = db
        .prepare('INSERT INTO Heats (event_id, heat_name, heat_type) VALUES (?, ?, ?)')
        .run(event_id, heatName, heatType);

      // Assign boats to the new heats
      for (let j = i; j < leaderboardResults.length; j += numHeats) {
        const boatId = leaderboardResults[j].boat_id;
        db.prepare('INSERT INTO HeatBoats (heat_id, boat_id) VALUES (?, ?)')
          .run(newHeatId, boatId);
      }
    }

    console.log('New heats created based on leaderboard.');
  } catch (err) {
    console.error('Error creating new heats based on leaderboard:', err.message);
    throw err;
  }
};

module.exports = {
  readAllHeats,
  insertHeat,
  readAllRaces,
  insertRace,
  readAllScores,
  insertScore,
  updateScore,
  deleteScore,
  insertHeatBoat,
  readBoatsByHeat,
  deleteHeatsByEvent,
  updateEventLeaderboard,
  updateGlobalLeaderboard,
  createNewHeatsBasedOnLeaderboard,
};
