/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

const calculateCategory = (birthday: string): number => {
  const birthYear = new Date(birthday).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  console.log('Age:', age);

  if (age <= 26) return 1; // Youth (U26)
  if (age >= 27 && age <= 54) return 2; // Senior (27-54)
  if (age >= 55 && age <= 65) return 3; // Master M (55-65)
  if (age >= 66 && age <= 70) return 4; // Grand Master GM (66-70)
  if (age >= 71 && age <= 75) return 5; // Great Grand Master GGM (71-75)
  if (age >= 76 && age <= 80) return 6; // Legend L (76-80)
  if (age >= 81) return 7; // Fantastic Legend FL (81+)
  return 1; // Default return value
};

interface SqliteError extends Error {
  code: string;
}

const log = (message: string) => {
  console.log(message);
};

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pongSailor'));
});

ipcMain.handle('readAllSailors', () => {
  try {
    const rows = db
      .prepare(
        `
SELECT
  s.sailor_id, s.name, s.surname, s.birthday,s.gender, s.category_id, s.club_id,
  b.sail_number, b.model,
  c.club_name, cat.category_name
FROM Sailors s
LEFT JOIN Clubs c ON s.club_id = c.club_id
LEFT JOIN Categories cat ON s.category_id = cat.category_id
LEFT JOIN Boats b ON s.sailor_id = b.sailor_id
    `,
      )
      .all();
    return rows;
  } catch (error) {
    log(`Error reading sailors: ${error}`);
    throw error;
  }
});

ipcMain.handle('insertClub', async (event, club_name, country) => {
  try {
    const result = db
      .prepare('INSERT INTO Clubs (club_name, country) VALUES (?, ?)')
      .run(club_name, country);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    log(`Error inserting club: ${error}`);
    throw error;
  }
});

ipcMain.handle(
  'insertBoat',
  async (event, sail_number, country, model, sailor_id) => {
    try {
      const result = db
        .prepare(
          'INSERT INTO Boats (sail_number, country, model, sailor_id) VALUES (?, ?, ?, ?)',
        )
        .run(sail_number, country, model, sailor_id);
      return { lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      const sqliteError = error as SqliteError;
      if (sqliteError.code === 'SQLITE_CONSTRAINT') {
        console.error('Error: The sail number already exists.');
        return { error: 'The sail number already exists.' };
      }
      console.error(`Error inserting boat: ${error}`);
      throw error;
    }
  },
);

ipcMain.handle('readAllCategories', () => {
  try {
    const rows = db.prepare('SELECT * FROM Categories').all();
    return rows;
  } catch (error) {
    log(`Error reading categories: ${error}`);
    throw error;
  }
});

ipcMain.handle('readAllClubs', () => {
  try {
    const rows = db.prepare('SELECT * FROM Clubs').all();
    return rows;
  } catch (error) {
    log(`Error reading clubs: ${error}`);
    throw error;
  }
});

ipcMain.handle('readAllBoats', () => {
  try {
    const rows = db
      .prepare(
        `SELECT
          b.boat_id, b.sail_number, b.country AS boat_country, b.model,
          s.name, s.surname, s.birthday, s.gender,
          c.club_name, c.country AS club_country,
          cat.category_name
        FROM Boats b
        JOIN Sailors s ON b.sailor_id = s.sailor_id
        JOIN Clubs c ON s.club_id = c.club_id
        JOIN Categories cat ON s.category_id = cat.category_id`,
      )
      .all();
    console.log('Boats:', rows);
    return rows;
  } catch (error) {
    log(`Error reading boats: ${error}`);
    throw error;
  }
});
ipcMain.handle('updateSailor', async (event, sailorData) => {
  const {
    originalClubName,
    name,
    surname,
    birthday,
    gender,
    club_name,
    boat_id,
    sail_number,
    country,
    model,
  } = sailorData;

  console.log('Received sailorData:', sailorData);

  try {
    // Lookup sailor_id based on boat_id
    const boat = db
      .prepare('SELECT sailor_id FROM Boats WHERE boat_id = ?')
      .get(boat_id);
    if (!boat) throw new Error(`Boat not found with boat_id: ${boat_id}`);
    const { sailor_id } = boat;

    // Fetch category_id based on birthday
    const category_id = calculateCategory(birthday);
    if (category_id === null)
      throw new Error(`Invalid category for birthday: ${birthday}`);

    // Verify that the category exists
    const category = db
      .prepare('SELECT category_id FROM Categories WHERE category_id = ?')
      .get(category_id);
    if (!category)
      throw new Error(
        `Category ID ${category_id} does not exist in the Categories table`,
      );

    // Fetch club_id based on original club name
    let club = db
      .prepare('SELECT club_id FROM Clubs WHERE club_name = ?')
      .get(originalClubName);
    if (!club) throw new Error(`Club not found: ${originalClubName}`);
    let { club_id } = club;

    if (club_name !== originalClubName) {
      club = db
        .prepare('SELECT club_id FROM Clubs WHERE club_name = ?')
        .get(club_name);
      if (club) {
        club_id = club.club_id;
      } else {
        // Insert new club and get the new club_id
        const newClub = db
          .prepare('INSERT INTO Clubs (club_name, country) VALUES (?, ?)')
          .run(club_name, country);
        club_id = newClub.lastInsertRowid;
      }
    }

    // Update sailor information including gender
    const sailorResult = db
      .prepare(
        'UPDATE Sailors SET name = ?, surname = ?, birthday = ?, gender = ?, category_id = ?, club_id = ? WHERE sailor_id = ?',
      )
      .run(name, surname, birthday, gender, category_id, club_id, sailor_id);
    console.log('Sailor update result:', sailorResult);

    // Update boat information
    const boatResult = db
      .prepare(
        'UPDATE Boats SET sail_number = ?, country = ?, model = ? WHERE boat_id = ?',
      )
      .run(sail_number, country, model, boat_id);
    console.log('Boat update result:', boatResult);

    return {
      sailorChanges: sailorResult.changes,
      boatChanges: boatResult.changes,
    };
  } catch (error) {
    console.error(`Error updating sailor or boat: ${error}`);
    // Rethrow so the renderer's catch block gets it
    throw error;
  }
});

ipcMain.handle(
  'insertSailor',
  async (event, name, surname, birthday, gender, category_id, club_id) => {
    const maxRetries = 5;
    const delay = (ms: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    const insertSailorWithRetry = async (
      attempt: number,
    ): Promise<{ lastInsertRowid: number }> => {
      try {
        // Log the received parameters
        log(
          `Inserting sailor with parameters: ${name}, ${surname}, ${birthday}, ${gender}, ${category_id}, ${club_id}`,
        );

        const result = db
          .prepare(
            'INSERT INTO Sailors (name, surname, birthday, gender, category_id, club_id) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(name, surname, birthday, gender, category_id, club_id);
        return { lastInsertRowid: result.lastInsertRowid };
      } catch (error) {
        const sqliteError = error as SqliteError;
        if (sqliteError.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          log(`Database is locked, retrying attempt ${attempt}...`);
          await delay(100 * attempt); // Exponential backoff
          return insertSailorWithRetry(attempt + 1);
        }
        log(`Error inserting sailor: ${error}`);
        throw error;
      }
    };

    return insertSailorWithRetry(1);
  },
);
