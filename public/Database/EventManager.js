/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath =
  process.env.NODE_ENV === 'development'
    ? './demo_table.db'
    : path.join(process.resourcesPath, './../../demo_table.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const readAllEvents = () => {
  try {
    const query = `
      SELECT
        event_id, event_name, event_location, start_date, end_date
      FROM Events
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all();
    console.log('Raw results from readAllEvents:', results); // Log the raw results
    return results;
  } catch (err) {
    console.error('Error reading all events from the database:', err.message);
    return [];
  }
};

const insertEvent = (event_name, event_location, start_date, end_date) => {
  try {
    const insertQuery = db.prepare(
      `INSERT INTO Events (event_name, event_location, start_date, end_date)
       VALUES (?, ?, ?)`,
    );
    const info = insertQuery.run(event_name, event_location, start_date, end_date);
    console.log(
      `Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Events.`,
    );
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    console.error('Error inserting event into the database:', err.message);
    throw err;
  }
};


module.exports = {
  readAllEvents,
  insertEvent,
};
