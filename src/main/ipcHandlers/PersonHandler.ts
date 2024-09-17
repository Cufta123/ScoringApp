import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

interface SqliteError extends Error {
  code: string;
}

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('readAllPerson', () => {
  try {
    const rows = db.prepare('SELECT * FROM person').all();
    return rows;
  } catch (error) {
    console.error('Error reading persons:', error);
    throw error;
  }
});

ipcMain.handle('insertPerson', async (event, name, surname, birthdate, category, club, sail_number, model) => {
  const maxRetries = 5;
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      db.prepare('INSERT INTO person (name, surname, birthdate, category, club, sail_number, model) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(name, surname, birthdate, category, club, sail_number, model);
      return { success: true };
    } catch (error) {
      const sqliteError = error as SqliteError;
      if (sqliteError.code === 'SQLITE_BUSY' && attempt < maxRetries) {
        console.warn(`Database is locked, retrying attempt ${attempt}...`);
        await delay(100 * attempt); // Exponential backoff
      } else {
        console.error('Error inserting person:', error);
        throw error;
      }
    }
  }
})
