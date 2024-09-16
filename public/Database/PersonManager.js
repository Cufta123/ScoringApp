const dbPath =
    process.env.NODE_ENV === "development"
        ? "./demo_table.db"
        : path.join(process.resourcesPath, "./demo_table.db")

const db = new Database(dbPath)
db.pragma("journal_mode = WAL")

exports.db = db
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.NODE_ENV === "development"
    ? "./demo_table.db"
    : path.join(process.resourcesPath, "./../../demo_table.db");

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');




const readAllPerson = () => {
  try {
    const query = SELECT * FROM person;
    const readQuery = db.prepare(query);
    return readQuery.all();
  } catch (err) {
    console.error("Error reading all persons from the database:", err.message);
    throw err;
  }
};

const insertPerson = (name, surname, birthdate, category, club, sail_number, model) => {
  if (!name || !surname || !sail_number) {
    throw new Error("Name, surname, and sail_number are required.");
  }

  try {
    const insertQuery = db.prepare(
      INSERT INTO person (name, surname, birthdate, category, club, sail_number, model)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    );

    const info = insertQuery.run(name, surname, birthdate, category, club, sail_number, model);
    console.log(Inserted ${info.changes} row(s) with last ID ${info.lastInsertRowid} into person.);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      console.error("Error: The sail_number already exists.");
    } else {
      console.error("Error inserting person into the database:", err.message);
    }
    throw err;
  }
};

const getAllClubs = () => {
  try {
    const query = SELECT DISTINCT club FROM person;
    const readQuery = db.prepare(query);
    return readQuery.all().map(row => row.club);
  } catch (err) {
    console.error("Error fetching clubs from the database:", err.message);
    throw err;
  }
};

module.exports = {
  readAllPerson,
  insertPerson,
  getAllClubs
};
