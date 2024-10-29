/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

interface SqliteError extends Error {
  code: string;
}
const log = (message: string) => {
  console.log(message);
};

console.log('EventHandler.ts loaded');

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pongSailor'));
});

ipcMain.handle('readAllEvents', async () => {
  try {
    const events = await db.prepare('SELECT * FROM Events').all();
    return events;
  } catch (error) {
    console.error('Error reading all events:', error);
    throw error;
  }
});

ipcMain.handle(
  'insertEvent',
  async (event, event_name, event_location, start_date, end_date) => {
    const maxRetries = 5;
    const delay = (ms: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });
    const insertEventWithRetry = async (
      attempt: number,
    ): Promise<{ lastInsertRowid: number }> => {
      try {
        const result = db
          .prepare(
            'INSERT INTO Events (event_name, event_location, start_date, end_date) VALUES (?, ?, ?, ?)',
          )
          .run(event_name, event_location, start_date, end_date);
        return { lastInsertRowid: result.lastInsertRowid };
      } catch (error) {
        const sqliteError = error as SqliteError;
        if (sqliteError.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          log(`Database is busy. Retrying in 100ms. Attempt ${attempt + 1}`);
          await delay(100 * attempt);
          return insertEventWithRetry(attempt + 1);
        }
        log(`Error inserting event: ${error}`);
        throw error;
      }
    };
    return insertEventWithRetry(1);
  },
);

ipcMain.handle('associateBoatWithEvent', async (event, boat_id, event_id) => {
  try {
    const result = db
      .prepare('INSERT INTO Boat_Event (boat_id, event_id) VALUES (?, ?)')
      .run(boat_id, event_id);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    log(`Error associating boat with event: ${error}`);
    throw error;
  }
});

ipcMain.handle('readBoatsByEvent', async (event, event_id) => {
  try {
    const rows = db
      .prepare(
        `
SELECT
  b.boat_id, b.sail_number, b.country AS boat_country, b.model,
  s.name, s.surname,
  c.club_name, c.country AS club_country,
  cat.category_name
FROM Boats b
JOIN Boat_Event be ON b.boat_id = be.boat_id
JOIN Sailors s ON b.sailor_id = s.sailor_id
JOIN Clubs c ON s.club_id = c.club_id
JOIN Categories cat ON s.category_id = cat.category_id
WHERE be.event_id = ?
        `,
      )
      .all(event_id);
    return rows;
  } catch (error) {
    console.error('Error reading boats by event:', error);
    throw error;
  }
});

ipcMain.handle('removeBoatFromEvent', async (event, boat_id, event_id) => {
  try {
    db.prepare('DELETE FROM Boat_Event WHERE boat_id = ? AND event_id = ?').run(
      boat_id,
      event_id,
    );
  } catch (error) {
    log(`Error removing boat from event: ${error}`);
    throw error;
  }
});
