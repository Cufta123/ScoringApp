import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

interface SqliteError extends Error {
  code: string;
}
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pongSailor'));
});

// Handler to read all sailors
ipcMain.handle('readAllSailors', () => {
  try {
    const rows = db.prepare(`
SELECT
  s.sailor_id, s.name, s.surname, s.birthday, s.category_id, s.club_id, s.boat_id,
  b.sail_number, b.model,
  c.club_name, cat.category_name
FROM Sailors s
LEFT JOIN Clubs c ON s.club_id = c.club_id
LEFT JOIN Categories cat ON s.category_id = cat.category_id
LEFT JOIN Boats b ON s.boat_id = b.boat_id
    `).all();
    return rows;
  } catch (error) {
    console.error('Error reading sailors:', error);
    throw error;
  }
});
ipcMain.handle('insertClub', async (event, club_name, country) => {
  try {
    const result = db.prepare('INSERT INTO Clubs (club_name, country) VALUES (?, ?)').run(club_name, country);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting club:', error);
    throw error;
  }
});

ipcMain.handle('insertBoat', async (event, sail_number, country, model) => {
  try {
    const result = db.prepare('INSERT INTO Boats (sail_number, country, model) VALUES (?, ?, ?)').run(sail_number, country, model);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting boat:', error);
    throw error;
  }
});
// Handler to read all categories
ipcMain.handle('readAllCategories', () => {
  try {
    const rows = db.prepare('SELECT * FROM Categories').all();
    return rows;
  } catch (error) {
    console.error('Error reading categories:', error);
    throw error;
  }
});

// Handler to read all clubs
ipcMain.handle('readAllClubs', () => {
  try {
    const rows = db.prepare('SELECT * FROM Clubs').all();
    return rows;
  } catch (error) {
    console.error('Error reading clubs:', error);
    throw error;
  }
});

ipcMain.handle('readAllBoats', () => {
  try {
    const rows = db.prepare('SELECT * FROM Boats').all();
    return rows;
  }
  catch (error) {
    console.error('Error reading boats:', error);
    throw error;
  }
});
// Handler to insert a new sailor
ipcMain.handle('insertSailor', async (event, name, surname, birthday, category_id, club_id, boat_id) => {
  const maxRetries = 5;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      db.prepare('INSERT INTO Sailors (name, surname, birthday, category_id, club_id, boat_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, surname, birthday, category_id, club_id, boat_id);
      return { success: true };
    } catch (error) {
      const sqliteError = error as SqliteError;
      if (sqliteError.code === 'SQLITE_BUSY' && attempt < maxRetries) {
        console.warn(`Database is locked, retrying attempt ${attempt}...`);
        await delay(100 * attempt); // Exponential backoff
      } else {
        console.error('Error inserting sailor:', error);
        throw error;
      }
    }
  }
});
