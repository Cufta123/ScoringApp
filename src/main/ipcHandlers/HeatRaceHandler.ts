/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';

console.log('HeatRaceHandler.ts loaded');

ipcMain.handle('readAllHeats', async (event, event_id) => {
  try {
    const heats = db
      .prepare('SELECT * FROM Heats WHERE event_id = ?')
      .all(event_id);
    return heats;
  } catch (error) {
    console.error('Error reading all heats:', error);
    throw error;
  }
});

ipcMain.handle('insertHeat', async (event, event_id, heat_name, heat_type) => {
  try {
    const result = db
      .prepare(
        'INSERT INTO Heats (event_id, heat_name, heat_type) VALUES (?, ?, ?)',
      )
      .run(event_id, heat_name, heat_type);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting heat:', error);
    throw error;
  }
});

ipcMain.handle('insertHeatBoat', async(event, heat_id, boat_id) => {
try {
  const result = db
    .prepare('INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)')
    .run(heat_id, boat_id);
  } catch (error) {
    console.error('Error inserting heat boat:', error);
    throw error;
  }
});
ipcMain.handle('readBoatsByHeat', async (event, heat_id) => {
  try {
    const boats = db
      .prepare(`
        SELECT b.boat_id, b.sail_number, b.country, b.model, s.name, s.surname
        FROM Heat_Boat hb
        JOIN Boats b ON hb.boat_id = b.boat_id
        JOIN Sailors s ON b.sailor_id = s.sailor_id
        WHERE hb.heat_id = ?
      `)
      .all(heat_id);
    return boats;
  } catch (error) {
    console.error('Error reading boats by heat:', error);
    throw error;
  }
});
ipcMain.handle('readAllRaces', async (event, heat_id) => {
  try {
    const races = db
      .prepare('SELECT * FROM Races WHERE heat_id = ?')
      .all(heat_id);
    return races;
  } catch (error) {
    console.error('Error reading all races:', error);
    throw error;
  }
});

ipcMain.handle('insertRace', async (event, heat_id, race_number) => {
  try {
    const result = db
      .prepare('INSERT INTO Races (heat_id, race_number) VALUES (?, ?)')
      .run(heat_id, race_number);
    return { lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('Error inserting race:', error);
    throw error;
  }
});

ipcMain.handle('readAllScores', async (event, race_id) => {
  try {
    const scores = db
      .prepare('SELECT * FROM Scores WHERE race_id = ?')
      .all(race_id);
    return scores;
  } catch (error) {
    console.error('Error reading all scores:', error);
    throw error;
  }
});

ipcMain.handle(
  'insertScore',
  async (event, race_id, boat_id, position, points, status) => {
    try {
      const result = db
        .prepare(
          'INSERT INTO Scores (race_id, boat_id, position, points, status) VALUES (?, ?, ?, ?, ?)',
        )
        .run(race_id, boat_id, position, points, status);
      return { lastInsertRowid: result.lastInsertRowid };
    } catch (error) {
      console.error('Error inserting score:', error);
      throw error;
    }
  },
);

ipcMain.handle(
  'updateScore',
  async (event, score_id, position, points, status) => {
    try {
      const result = db
        .prepare(
          'UPDATE Scores SET position = ?, points = ?, status = ? WHERE score_id = ?',
        )
        .run(position, points, status, score_id);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error updating score:', error);
      throw error;
    }
  },
);

ipcMain.handle('deleteScore', async (event, score_id) => {
  try {
    const result = db
      .prepare('DELETE FROM Scores WHERE score_id = ?')
      .run(score_id);
    return { changes: result.changes };
  } catch (error) {
    console.error('Error deleting score:', error);
    throw error;
  }
});
