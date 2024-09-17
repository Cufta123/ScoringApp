const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.NODE_ENV === "development"
    ? "./demo_table.db"
    : path.join(process.resourcesPath, "./../../demo_table.db");

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const readAllSailors = () => {
  try {
    const query = `
      SELECT
        s.sailor_id, s.name, s.surname, s.category_id, s.club_id, s.boat_id,
        b.sail_number, b.model,
        c.club_name, cat.category_name
      FROM Sailors s
      LEFT JOIN Clubs c ON s.club_id = c.club_id
      LEFT JOIN Categories cat ON s.category_id = cat.category_id
      LEFT JOIN Boats b ON s.boat_id = b.boat_id
    `;
    const readQuery = db.prepare(query);
    return readQuery.all();
  } catch (err) {
    console.error("Error reading all sailors from the database:", err.message);
    throw err;
  }
};

const insertSailor = (name, surname, birthdate, category_id, club_id, boat_id) => {
  if (!name || !surname || !birthdate || !category_id || !club_id || !boat_id) {
    throw new Error("Name, surname, birthdate, category_id, club_id, and boat_id are required.");
  }

  try {
    const insertSailorQuery = db.prepare(
      `INSERT INTO Sailors (name, surname, birthdate, category_id, club_id, boat_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const sailorInfo = insertSailorQuery.run(name, surname, birthdate, category_id, club_id, boat_id);
    console.log(`Inserted ${sailorInfo.changes} row(s) with last ID ${sailorInfo.lastInsertRowid} into Sailors.`);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      console.error("Error: The sailor already exists.");
    } else {
      console.error("Error inserting sailor into the database:", err.message);
    }
    throw err;
  }
};

const insertClub = (club_name, country) => {
  if (!club_name || !country) {
    throw new Error("Club name and country are required.");
  }

  try {
    const insertQuery = db.prepare(
      `INSERT INTO Clubs (club_name, country)
       VALUES (?, ?)`
    );

    const info = insertQuery.run(club_name, country);
    console.log(`Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Clubs.`);
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      console.error("Error: The club already exists.");
    } else {
      console.error("Error inserting club into the database:", err.message);
    }
    throw err;
  }
};

const insertBoat = (sail_number, country, model) => {
  if (!sail_number || !model) {
    throw new Error("Sail number and model are required.");
  }

  try {
    const insertQuery = db.prepare(
      `INSERT INTO Boats (sail_number, country, model)
       VALUES (?, ?, ?)`
    );

    const info = insertQuery.run(sail_number, country, model);
    console.log(`Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into Boats.`);
    return { lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      console.error("Error: The sail number already exists.");
    } else {
      console.error("Error inserting boat into the database:", err.message);
    }
    throw err;
  }
};

const readAllCategories = () => {
  try {
    const query = `SELECT * FROM Categories`;
    const readQuery = db.prepare(query);
    return readQuery.all();
  } catch (err) {
    console.error("Error reading all categories from the database:", err.message);
    throw err;
  }
};

const readAllClubs = () => {
  try {
    const query = `SELECT * FROM Clubs`;
    const readQuery = db.prepare(query);
    return readQuery.all();
  } catch (err) {
    console.error("Error reading all clubs from the database:", err.message);
    throw err;
  }

};
const readAllBoats = () => {
  const query = `SELECT * FROM Boats`;
  const readQuery = db.prepare(query);
  return readQuery.all();
} catch (err) {
  console.error("Error reading all boats from the database:", err.message);
  throw err;
};

module.exports = {
  readAllSailors,
  insertSailor,
  insertClub,
  insertBoat,
  readAllCategories,
  readAllClubs,
  readAllBoats,
};
