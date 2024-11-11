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
};