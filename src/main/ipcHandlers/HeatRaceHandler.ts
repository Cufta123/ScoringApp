/* eslint-disable no-console */
/* eslint-disable camelcase */
import { ipcMain } from 'electron';
import { db } from '../../../public/Database/DBManager';
import calculateBoatScores from '../functions/calculateBoatScores';

import {
  assignBoatsToNewHeats,
  checkRaceCountForLatestHeats,
  findLatestHeatsBySuffix,
  generateNextHeatNames,
} from '../functions/creatingNewHeatsUtls';
import calculateFinalBoatScores from '../functions/calculateFinalBoatScores';

console.log('HeatRaceHandler.ts loaded');

const isEventLocked = (event_id: any) => {
  const query = `SELECT is_locked FROM Events WHERE event_id = ?`;
  const checkQuery = db.prepare(query);
  const result = checkQuery.get(event_id);
  return result.is_locked === 1;
};

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
  if (isEventLocked(event_id)) {
    throw new Error('Cannot insert heat for locked event.');
  }
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

ipcMain.handle('insertHeatBoat', async (event, heat_id, boat_id) => {
  try {
    const result = db
      .prepare('INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)')
      .run(heat_id, boat_id);
  } catch (error) {
    console.error('Error inserting heat boat:', error);
    throw error;
  }
});
ipcMain.handle('deleteHeatsByEvent', async (event, event_id) => {
  if (isEventLocked(event_id)) {
    throw new Error('Cannot insert heat for locked event.');
  }
  try {
    const result = db
      .prepare(
        'DELETE FROM Heat_Boat WHERE heat_id IN (SELECT heat_id FROM Heats WHERE event_id = ?)',
      )
      .run(event_id);
    console.log(
      `Deleted ${result.changes} row(s) from Heat_Boat for event ID ${event_id}.`,
    );

    const resultHeats = db
      .prepare('DELETE FROM Heats WHERE event_id = ?')
      .run(event_id);
    console.log(
      `Deleted ${resultHeats.changes} row(s) from Heats for event ID ${event_id}.`,
    );

    return {
      heatBoatsChanges: result.changes,
      heatsChanges: resultHeats.changes,
    };
  } catch (error) {
    console.error('Error deleting heats by event:', error);
    throw error;
  }
});
ipcMain.handle('readBoatsByHeat', async (event, heat_id) => {
  try {
    const boats = db
      .prepare(
        `
        SELECT b.boat_id, b.sail_number, b.country, b.model, s.name, s.surname
        FROM Heat_Boat hb
        JOIN Boats b ON hb.boat_id = b.boat_id
        JOIN Sailors s ON b.sailor_id = s.sailor_id
        WHERE hb.heat_id = ?
      `,
      )
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
ipcMain.handle('updateEventLeaderboard', async (event, event_id) => {
  if (isEventLocked(event_id)) {
    throw new Error('Cannot insert heat for locked event.');
  }
  try {
    // 1. Get summary results for each boat in the event.
    const summaryQuery = `
      SELECT boat_id, SUM(points) as total_points_event, COUNT(DISTINCT Races.race_id) as number_of_races
      FROM Scores
      JOIN Races ON Scores.race_id = Races.race_id
      JOIN Heats ON Races.heat_id = Heats.heat_id
      WHERE Heats.event_id = ?
      GROUP BY boat_id
      ORDER BY total_points_event ASC
    `;
    const summaryResults = db.prepare(summaryQuery).all(event_id);

    // 2. Fetch all raw scores for the event. (sorted as needed)
    const scoresQuery = db.prepare(`
      SELECT s.boat_id, s.points, r.race_number
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ?
      ORDER BY s.points DESC, r.race_number DESC
    `);
    const rawScores = scoresQuery.all(event_id);

    // 3. Calculate the temporary leaderboard from the raw data.
    // The calculateBoatScores function now becomes pure, using summaryResults and rawScores.
    const setFinalSeriesStarted = false;
    const temporaryTable = calculateBoatScores(
      summaryResults,
      rawScores,
      setFinalSeriesStarted,
    );

    // 4. Update the Leaderboard table.
    const updateQuery = db.prepare(
      `INSERT INTO Leaderboard (boat_id, total_points_event, event_id, place)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(boat_id, event_id) DO UPDATE SET total_points_event = excluded.total_points_event, place = excluded.place`,
    );
    temporaryTable.forEach((boat) => {
      updateQuery.run(boat.boat_id, boat.totalPoints, event_id, boat.place);
    });
  } catch (error) {
    console.error(
      'Error updating event leaderboard:',
      (error as Error).message,
    );
    throw error;
  }
});

ipcMain.handle('updateGlobalLeaderboard', async (event, event_id) => {
  if (isEventLocked(event_id)) {
    throw new Error('Cannot insert heat for locked event.');
  }
  try {
    const query = `
      SELECT boat_id, RANK() OVER (ORDER BY total_points_event ASC) as final_position
      FROM Leaderboard
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all();

    const updateQuery = db.prepare(
      `INSERT INTO GlobalLeaderboard (boat_id, total_points_global)
       VALUES (?, ?)
       ON CONFLICT(boat_id) DO UPDATE SET total_points_global = total_points_global + excluded.total_points_global`,
    );
    const setFinalSeriesStarted = false;
    const temporaryTable = calculateBoatScores(
      results,
      event_id,
      setFinalSeriesStarted,
    );
    // Update the leaderboard with the sorted results
    temporaryTable.forEach((boat) => {
      updateQuery.run(boat.boat_id, boat.totalPoints, event_id, boat.place);
    });

    console.log('Global leaderboard updated successfully.');
    return { success: true };
  } catch (error) {
    console.error('Error updating global leaderboard:', error);
    throw error;
  }
});

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

ipcMain.handle('createNewHeatsBasedOnLeaderboard', async (event, event_id) => {
  if (isEventLocked(event_id)) {
    throw new Error('Cannot insert heat for locked event.');
  }
  try {
    // Read the existing heats for the event
    const existingHeatsQuery = db.prepare(
      `SELECT heat_name, heat_id FROM Heats WHERE event_id = ?`,
    );
    const existingHeats = existingHeatsQuery.all(event_id);

    // Find the latest heats by suffix
    const latestHeats = findLatestHeatsBySuffix(existingHeats);
    console.log('Latest Heats in the heatRaceHandler:', latestHeats);
    // Check race count for the latest heats
    checkRaceCountForLatestHeats(latestHeats, db);

    // Define the new race number
    const heatNameMatch = latestHeats[0].heat_name.match(/(\d+)$/);
    const lastRaceNumber = heatNameMatch ? parseInt(heatNameMatch[1], 10) : 0;
    const raceNumber = lastRaceNumber + 1;
    console.log(raceNumber);
    // Generate names for the next round of heats
    const nextHeatNames = generateNextHeatNames(latestHeats);

    // Insert new heats into the database
    const heatIds: any[] = [];
    for (let i = 0; i < nextHeatNames.length; i += 1) {
      const heatName = nextHeatNames[i];
      const heatType = 'Qualifying';

      const { lastInsertRowid: newHeatId } = db
        .prepare(
          'INSERT INTO Heats (event_id, heat_name, heat_type) VALUES (?, ?, ?)',
        )
        .run(event_id, heatName, heatType);

      heatIds.push(newHeatId);
    }

    // Assign boats to new heats
    const assignments = assignBoatsToNewHeats(
      nextHeatNames,
      raceNumber,
      event_id,
      latestHeats,
    );

    assignments.forEach(({ heatId, boatId }) => {
      db.prepare('INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)').run(
        heatIds[heatId],
        boatId,
      );
    });

    console.log('New heats created based on leaderboard.');
    return { success: true };
  } catch (error) {
    console.error(
      'Error creating new heats based on leaderboard:',
      (error as Error).message,
    );
    throw error;
  }
});

ipcMain.handle(
  'transferBoatBetweenHeats',
  async (event, from_heat_id, to_heat_id, boat_id) => {
    try {
      const deleteQuery = db.prepare(
        'DELETE FROM Heat_Boat WHERE heat_id = ? AND boat_id = ?',
      );
      const deleteInfo = deleteQuery.run(from_heat_id, boat_id);
      console.log(
        `Deleted ${deleteInfo.changes} row(s) from HeatBoats for heat ID ${from_heat_id} and boat ID ${boat_id}.`,
      );

      const insertQuery = db.prepare(
        'INSERT INTO Heat_Boat (heat_id, boat_id) VALUES (?, ?)',
      );
      const insertInfo = insertQuery.run(to_heat_id, boat_id);
      console.log(
        `Inserted ${insertInfo.changes} row(s) with last ID ${insertInfo.lastInsertRowid} into HeatBoats for heat ID ${to_heat_id}.`,
      );

      return { success: true };
    } catch (error) {
      console.error('Error transferring boat between heats:', error);
      throw error;
    }
  },
);

ipcMain.handle(
  'updateRaceResult',
  async (
    event,
    event_id,
    race_id,
    boat_id,
    new_position,
    shift_positions,
    heat_id,
  ) => {
    try {
      console.log(
        `Updating race result for event_id: ${event_id}, race_id: ${race_id}, boat_id: ${boat_id}, new_position: ${new_position}, shift_positions: ${shift_positions}, heat_id: ${heat_id}`,
      );

      // Step 1: Get the current race result.
      const currentResult = db
        .prepare(
          `SELECT position FROM Scores WHERE race_id = ? AND boat_id = ?`,
        )
        .get(race_id, boat_id);

      if (!currentResult) {
        console.error(
          `Current result not found for race_id: ${race_id}, boat_id: ${boat_id}`,
        );
        throw new Error('Current result not found.');
      }

      const currentPosition = currentResult.position;

      // Step 2: Update both position and points in the Scores table for the specific heat.
      const updateQuery = db.prepare(
        `UPDATE Scores SET position = ?, points = ? WHERE race_id = ? AND boat_id = ?`,
      );
      updateQuery.run(new_position, new_position, race_id, boat_id);

      // Step 3: Optionally shift positions if needed, but only for boats in the same heat.
      if (shift_positions) {
        if (currentPosition > new_position) {
          // Boat moved up, shift others down.
          const affectedBoats = db
            .prepare(
              `SELECT boat_id, position FROM Scores
               WHERE race_id = ?
                 AND position >= ?
                 AND position < ?
                 AND boat_id != ?
                 AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
            )
            .all(race_id, new_position, currentPosition, boat_id, heat_id);

          console.log(
            'Shifting down boats (moved up scenario). Affected boats:',
            affectedBoats,
          );

          const shiftQuery = db.prepare(
            `UPDATE Scores
             SET position = position + 1
             WHERE race_id = ?
               AND position >= ?
               AND position < ?
               AND boat_id != ?
               AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
          );
          const result = shiftQuery.run(
            race_id,
            new_position,
            currentPosition,
            boat_id,
            heat_id,
          );
          console.log(`Shift down complete. Rows updated: ${result.changes}`);
        } else if (currentPosition < new_position) {
          // Boat moved down, shift others up.
          const affectedBoats = db
            .prepare(
              `SELECT boat_id, position FROM Scores
               WHERE race_id = ?
                 AND position <= ?
                 AND position > ?
                 AND boat_id != ?
                 AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
            )
            .all(race_id, new_position, currentPosition, boat_id, heat_id);

          console.log(
            'Shifting up boats (moved down scenario). Affected boats:',
            affectedBoats,
          );

          const shiftQuery = db.prepare(
            `UPDATE Scores
             SET position = position - 1
             WHERE race_id = ?
               AND position <= ?
               AND position > ?
               AND boat_id != ?
               AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
          );
          const result = shiftQuery.run(
            race_id,
            new_position,
            currentPosition,
            boat_id,
            heat_id,
          );
          console.log(`Shift up complete. Rows updated: ${result.changes}`);
        }
      }

      // Step 4: Leaderboard update will occur later via updateEventLeaderboard.
      return { success: true };
    } catch (err) {
      console.error('Error updating race result:', (err as Error).message);
      throw err;
    }
  },
);

ipcMain.handle('getRaceMapping', async (event, event_id) => {
  try {
    const query = `
      SELECT r.race_id, h.heat_id
      FROM Races r
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ?
    `;
    const rows = db.prepare(query).all(event_id);
    // Build a mapping object where keys are race_id and values are heat_id.
    const mapping: { [key: string]: string } = {};
    rows.forEach(
      (row: {
        race_id: string | number;
        heat_id: { toString: () => string };
      }) => {
        mapping[row.race_id] = row.heat_id.toString();
      },
    );
    console.log('Generated race mapping:', mapping);
    return mapping;
  } catch (error) {
    console.error('Error getting race mapping:', (error as Error).message);
    throw error;
  }
});

ipcMain.handle('readLeaderboard', async (event, event_id) => {
  try {
    const query = `
      SELECT
        lb.boat_id,
        lb.total_points_event,
        lb.place,
        b.sail_number AS boat_number,
        b.model AS boat_type,
        s.name,
        s.surname,
        b.country,
        GROUP_CONCAT(sc.position ORDER BY r.race_number) AS race_positions,
        GROUP_CONCAT(r.race_id ORDER BY r.race_number) AS race_ids
      FROM Leaderboard lb
      LEFT JOIN Boats b ON lb.boat_id = b.boat_id
      LEFT JOIN Sailors s ON b.sailor_id = s.sailor_id
      LEFT JOIN Heat_Boat hb ON b.boat_id = hb.boat_id
      LEFT JOIN Heats h ON hb.heat_id = h.heat_id
      LEFT JOIN Races r ON hb.heat_id = r.heat_id
      LEFT JOIN Scores sc ON r.race_id = sc.race_id AND sc.boat_id = b.boat_id
      WHERE lb.event_id = ? AND h.event_id = ? AND h.heat_type = 'Qualifying'
      GROUP BY lb.boat_id
      ORDER BY lb.place ASC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id, event_id);
    return results;
  } catch (error) {
    console.error('Error reading leaderboard:', error);
    throw error;
  }
});
ipcMain.handle('readGlobalLeaderboard', async () => {
  try {
    const results = db
      .prepare(
        `
        SELECT
          gl.boat_id,
          gl.total_points_global,
          b.sail_number AS boat_number,
          b.model AS boat_type,
          s.name,
          s.surname,
          b.country
        FROM GlobalLeaderboard gl
        LEFT JOIN Boats b ON gl.boat_id = b.boat_id
        LEFT JOIN Sailors s ON b.sailor_id = s.sailor_id
        ORDER BY gl.total_points_global ASC
      `,
      )
      .all();
    return results;
  } catch (error) {
    console.error('Error reading global leaderboard:', error);
    throw error;
  }
});

ipcMain.handle('updateFinalLeaderboard', async (event, event_id) => {
  if (isEventLocked(event_id)) {
    throw new Error('Cannot update final leaderboard for locked event.');
  }
  try {
    const query = `
      SELECT boat_id, heat_name, SUM(points) as total_points_final, COUNT(DISTINCT Races.race_id) as number_of_races
      FROM Scores
      JOIN Races ON Scores.race_id = Races.race_id
      JOIN Heats ON Races.heat_id = Heats.heat_id
      WHERE Heats.event_id = ? AND Heats.heat_type = 'Final'
      GROUP BY boat_id, heat_name
      ORDER BY heat_name, total_points_final ASC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id);

    const updateQuery = db.prepare(
      `INSERT INTO FinalLeaderboard (boat_id, total_points_final, event_id, placement_group, place)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(boat_id, event_id) DO UPDATE SET total_points_final = excluded.total_points_final, placement_group = excluded.placement_group, place = excluded.place`,
    );
    const pointsMap = new Map<number, any[]>();
    const temporaryTable = calculateFinalBoatScores(
      results,
      event_id,
      pointsMap,
    );

    temporaryTable.forEach((boat) => {
      console.log('Updating FinalLeaderboard with:', boat);
      updateQuery.run(
        boat.boat_id,
        boat.totalPoints,
        event_id,
        boat.placement_group,
        boat.place,
      );
    });

    return { success: true };
  } catch (error) {
    console.error(
      'Error updating final leaderboard:',
      (error as Error).message,
    );
    throw error;
  }
});
ipcMain.handle('readFinalLeaderboard', async (event, event_id) => {
  try {
    const query = `
      SELECT
        fl.boat_id,
        fl.total_points_final,
        fl.event_id,
        fl.placement_group,
        fl.place,
        b.sail_number AS boat_number,
        b.model AS boat_type,
        s.name,
        s.surname,
        b.country,
        GROUP_CONCAT(sc.position ORDER BY r.race_number) AS race_positions,
        GROUP_CONCAT(r.race_id ORDER BY r.race_number) AS race_ids
      FROM FinalLeaderboard fl
      LEFT JOIN Boats b ON fl.boat_id = b.boat_id
      LEFT JOIN Sailors s ON b.sailor_id = s.sailor_id
      LEFT JOIN Heat_Boat hb ON b.boat_id = hb.boat_id
      LEFT JOIN Heats h ON hb.heat_id = h.heat_id
      LEFT JOIN Races r ON hb.heat_id = r.heat_id
      LEFT JOIN Scores sc ON r.race_id = sc.race_id AND sc.boat_id = b.boat_id
      WHERE fl.event_id = ? AND h.event_id = ? AND h.heat_type = 'Final'
      GROUP BY fl.boat_id
      ORDER BY fl.placement_group, fl.place ASC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id, event_id);
    return results;
  } catch (error) {
    console.error('Error reading final leaderboard:', error);
    throw error;
  }
});

ipcMain.handle('getSummaryResults', async (event, event_id) => {
  try {
    const query = `
      SELECT boat_id, SUM(points) as total_points_event, COUNT(DISTINCT Races.race_id) as number_of_races
      FROM Scores
      JOIN Races ON Scores.race_id = Races.race_id
      JOIN Heats ON Races.heat_id = Heats.heat_id
      WHERE Heats.event_id = ?
      GROUP BY boat_id
      ORDER BY total_points_event ASC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id);
    return results;
  } catch (error) {
    console.error('Error reading boat scores ordered by points:', error);
    throw error;
  }
});

ipcMain.handle('getScoresResult', async (event, event_id) => {
  try {
    const query = `
      SELECT s.boat_id, s.points, r.race_number
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ?
      ORDER BY s.points DESC, r.race_number DESC
    `;
    const readQuery = db.prepare(query);
    const results = readQuery.all(event_id);
    return results;
  } catch (error) {
    console.error('Error reading boat scores ordered by race number:', error);
    throw error;
  }
});
