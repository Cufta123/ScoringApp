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
};
