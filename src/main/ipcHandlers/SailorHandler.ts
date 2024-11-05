/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

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
  s.sailor_id, s.name, s.surname, s.birthday, s.category_id, s.club_id,
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
      s.name, s.surname,
      c.club_name, c.country AS club_country,
      cat.category_name
    FROM Boats b
    JOIN Sailors s ON b.sailor_id = s.sailor_id
    JOIN Clubs c ON s.club_id = c.club_id
    JOIN Categories cat ON s.category_id = cat.category_id`,
      )
      .all();
    return rows;
  } catch (error) {
    log(`Error reading boats: ${error}`);
    throw error;
  }
});

ipcMain.handle(
  'updateSailor',
  async (event, sailor_id, name, surname, birthday, category_id, club_id) => {
    try {
      console.log('Updating sailor:', {
        sailor_id,
        name,
        surname,
        birthday,
        category_id,
        club_id,
      }); // Log the data being updated
      const result = db
        .prepare(
          'UPDATE Sailors SET name = ?, surname = ?, birthday = ?, category_id = ?, club_id = ? WHERE sailor_id = ?',
        )
        .run(name, surname, birthday, category_id, club_id, sailor_id);
      console.log('Update result:', result); // Log the result
      return { changes: result.changes };
    } catch (error) {
      log(`Error updating sailor: ${error}`);
      throw error;
    }
  },
);

ipcMain.handle(
  'insertSailor',
  async (event, name, surname, birthday, category_id, club_id) => {
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
          `Inserting sailor with parameters: ${name}, ${surname}, ${birthday}, ${category_id}, ${club_id}`,
        );

        const result = db
          .prepare(
            'INSERT INTO Sailors (name, surname, birthday, category_id, club_id) VALUES (?, ?, ?, ?, ?)',
          )
          .run(name, surname, birthday, category_id, club_id);
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
