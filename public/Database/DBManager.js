/* eslint-disable no-console */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Define the path for the database file
const dbPath = app.isPackaged
  ? path.join(app.getPath('userData'), 'scoring_app.db')
  : path.join(__dirname, 'public', 'Database', 'data', 'scoring_app.db');

// Define the directory that will contain the database file
const dataDir = path.dirname(dbPath);

console.log(`Database directory: ${dataDir}`);
console.log(`Database path: ${dbPath}`);

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
  console.log(`Data directory does not exist. Creating ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
} else {
  console.log(`Data directory already exists: ${dataDir}`);
}

// Initialize the database
console.log('Initializing database...');
const db = new Database(dbPath); // Creates the database file when used
db.pragma('journal_mode = WAL');
console.log('Database initialized.');

// Function to initialize the database schema
const initializeSchema = () => {
  console.log('Initializing database schema...');

  // Table creation statements
  const createEventsTable = `
    CREATE TABLE IF NOT EXISTS Events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      event_location TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_locked INTEGER DEFAULT 0
    );
  `;
  const createSailorsTable = `
    CREATE TABLE IF NOT EXISTS Sailors (
      sailor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT NOT NULL,
      birthday TEXT NOT NULL,
      category_id INTEGER,
      club_id INTEGER,
      FOREIGN KEY (category_id) REFERENCES Categories(category_id),
      FOREIGN KEY (club_id) REFERENCES Clubs(club_id)
    );
  `;
  const createBoatsTable = `
    CREATE TABLE IF NOT EXISTS Boats (
      boat_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sail_number INTEGER NOT NULL UNIQUE,
      country TEXT NOT NULL,
      model TEXT NOT NULL,
      sailor_id INTEGER,
      FOREIGN KEY (sailor_id) REFERENCES Sailors(sailor_id)
    );
  `;
  const createClubsTable = `
    CREATE TABLE IF NOT EXISTS Clubs (
      club_id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_name TEXT NOT NULL,
      country TEXT NOT NULL
    );
  `;
  const createCategoriesTable = `
  CREATE TABLE IF NOT EXISTS Categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL
  );
  INSERT INTO Categories (category_id, category_name) VALUES (1, 'Youth')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (2, 'Open')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (3, 'Master M')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (4, 'Grand Master GM')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (5, 'Great Grand Master GGM')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (6, 'Legend L')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
  INSERT INTO Categories (category_id, category_name) VALUES (7, 'Fantastic Legend FL')
    ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name;
`;
  const createBoatEventTable = `
    CREATE TABLE IF NOT EXISTS Boat_Event (
      boat_event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      boat_id INTEGER,
      event_id INTEGER,
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
    );
  `;
  const createHeatsTable = `
    CREATE TABLE IF NOT EXISTS Heats (
      heat_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      heat_name TEXT NOT NULL,
      heat_type TEXT NOT NULL, -- 'Qualifying' or 'Final'
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
    );
  `;
  const createRacesTable = `
    CREATE TABLE IF NOT EXISTS Races (
      race_id INTEGER PRIMARY KEY AUTOINCREMENT,
      heat_id INTEGER NOT NULL,
      race_number INTEGER NOT NULL,
      FOREIGN KEY (heat_id) REFERENCES Heats(heat_id)
    );
  `;
  const createScoresTable = `
    CREATE TABLE IF NOT EXISTS Scores (
      score_id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      boat_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      points INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'DNF', 'RET', 'NSC', 'OCS', 'DNS', 'DNC', 'WTH', 'UFD', 'BFD', 'DSQ', 'DNE'
      FOREIGN KEY (race_id) REFERENCES Races(race_id),
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id)
    );
  `;
  const createHeatBoatTable = `
    CREATE TABLE IF NOT EXISTS Heat_Boat (
      heat_id INTEGER,
      boat_id INTEGER,
      FOREIGN KEY (heat_id) REFERENCES Heats(heat_id),
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id)
    );
  `;
  const createLiderboardTable = `
    CREATE TABLE IF NOT EXISTS Leaderboard (
      boat_id INTEGER,
      total_points_event INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      place INTEGER,
      PRIMARY KEY (boat_id, event_id),
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
    );
  `;
  const createGlobalLeaderboardTable = `
    CREATE TABLE IF NOT EXISTS GlobalLeaderboard (
      boat_id INTEGER PRIMARY KEY,
      total_points_global INTEGER NOT NULL,
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id)
    );
  `;
  const createFinalLeaderboardTable = `
    CREATE TABLE IF NOT EXISTS FinalLeaderboard (
      boat_id INTEGER,
      total_points_final INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      placement_group TEXT NOT NULL,
      place INTEGER,
      PRIMARY KEY (boat_id, event_id),
      FOREIGN KEY (boat_id) REFERENCES Boats(boat_id),
      FOREIGN KEY (event_id) REFERENCES Events(event_id)
    );
  `;

  // Expected column names for each table
  const expectedSchemas = {
    Events: [
      'event_id',
      'event_name',
      'event_location',
      'start_date',
      'end_date',
      'is_locked',
    ],
    Sailors: [
      'sailor_id',
      'name',
      'surname',
      'birthday',
      'category_id',
      'club_id',
    ],
    Boats: ['boat_id', 'sail_number', 'country', 'model', 'sailor_id'],
    Clubs: ['club_id', 'club_name', 'country'],
    Categories: ['category_id', 'category_name'],
    Boat_Event: ['boat_event_id', 'boat_id', 'event_id'],
    Heats: ['heat_id', 'event_id', 'heat_name', 'heat_type'],
    Races: ['race_id', 'heat_id', 'race_number'],
    Scores: ['score_id', 'race_id', 'boat_id', 'position', 'points', 'status'],
    Heat_Boat: ['heat_id', 'boat_id'],
    Leaderboard: ['boat_id', 'total_points_event', 'event_id', 'place'],
    GlobalLeaderboard: ['boat_id', 'total_points_global'],
    FinalLeaderboard: [
      'boat_id',
      'total_points_final',
      'event_id',
      'placement_group',
      'place',
    ],
  };

  // Mapping of table names to their creation statements
  const tableStatements = {
    Events: createEventsTable,
    Sailors: createSailorsTable,
    Boats: createBoatsTable,
    Clubs: createClubsTable,
    Categories: createCategoriesTable,
    Boat_Event: createBoatEventTable,
    Heats: createHeatsTable,
    Races: createRacesTable,
    Scores: createScoresTable,
    Heat_Boat: createHeatBoatTable,
    Leaderboard: createLiderboardTable,
    GlobalLeaderboard: createGlobalLeaderboardTable,
    FinalLeaderboard: createFinalLeaderboardTable,
  };

  // Helper function to check the table structure and recreate if necessary
  const checkAndRecreateTable = (tableName, createSQL, expectedCols) => {
    const currentInfo = db.prepare(`PRAGMA table_info(${tableName});`).all();
    const currentCols = currentInfo.map((col) => col.name).sort();
    const expectedSorted = expectedCols.slice().sort();
    if (JSON.stringify(currentCols) !== JSON.stringify(expectedSorted)) {
      console.log(
        `Schema mismatch for ${tableName}. Dropping and recreating the table...`,
      );
      db.exec(`DROP TABLE IF EXISTS ${tableName};`);
      db.exec(createSQL);
      console.log(`${tableName} table recreated.`);
    } else {
      console.log(`${tableName} schema matches expected.`);
    }
  };

  try {
    // Ensure tables are created in order to satisfy FK constraints
    const tableOrder = [
      'Events',
      'Sailors',
      'Boats',
      'Clubs',
      'Categories',
      'Boat_Event',
      'Heats',
      'Races',
      'Scores',
      'Heat_Boat',
      'Leaderboard',
      'GlobalLeaderboard',
      'FinalLeaderboard',
    ];

    tableOrder.forEach((tableName) => {
      // First, attempt to create the table if it doesn't exist
      db.exec(tableStatements[tableName]);
      // Then, check if its structure matches expectation; if not, drop and recreate.
      checkAndRecreateTable(
        tableName,
        tableStatements[tableName],
        expectedSchemas[tableName],
      );
    });

    // Special migration step: ensure the 'place' column exists in FinalLeaderboard
    const finalLeaderboardInfo = db
      .prepare('PRAGMA table_info(FinalLeaderboard);')
      .all();
    const hasPlace = finalLeaderboardInfo.some((col) => col.name === 'place');
    if (!hasPlace) {
      console.log("Adding 'place' column to FinalLeaderboard table...");
      db.exec('ALTER TABLE FinalLeaderboard ADD COLUMN place INTEGER;');
      console.log("'place' column added to FinalLeaderboard table.");
    }

    console.log('Database schema initialized successfully.');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
};

// Function to check if the Events table exists
const checkEventsTable = () => {
  try {
    const stmt = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Events';",
    );
    const result = stmt.get();
    if (result) {
      console.log('Events table exists.');
    } else {
      console.log('Events table does not exist.');
    }
  } catch (error) {
    console.error('Error checking Events table:', error);
  }
};

// Initialize the database schema and check for the Events table
initializeSchema();
checkEventsTable();
console.log(`Database path: ${dbPath}`);
module.exports = { db };
