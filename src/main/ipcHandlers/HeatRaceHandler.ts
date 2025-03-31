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

ipcMain.handle('getHeatDetails', async (event, heat_id) => {
  try {
    const query = `SELECT * FROM Heats WHERE heat_id = ?`;
    const getQuery = db.prepare(query);
    return getQuery.get(heat_id);
  } catch (error) {
    console.error('Error getting heat details:', error);
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
ipcMain.handle(
  'updateEventLeaderboard',
  async (event, event_id, finalSeriesStarted) => {
    if (isEventLocked(event_id)) {
      throw new Error('Cannot insert heat for locked event.');
    }
    console.log('Final series started:', finalSeriesStarted);
    try {
      if (finalSeriesStarted) {
        // When finals have started, skip updating the qualifying leaderboard.
        console.log('Final Series started; skipping updateEventLeaderboard.');
        return { success: true };
      }
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

      // 2. Fetch all raw scores for the event.
      const scoresQuery = db.prepare(`
      SELECT s.boat_id, s.points, s.status, r.race_number, h.heat_name, h.heat_id
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ?
      ORDER BY s.points DESC, r.race_number DESC
    `);
      const rawScores = scoresQuery.all(event_id);
      console.log('Raw scores:', rawScores);

      // 3. Calculate the temporary leaderboard.
      const temporaryTable = calculateBoatScores(
        summaryResults,
        rawScores,
        false, // qualifying: always false
      );

      // 4. Update the qualifying Leaderboard table.
      const updateQuery = db.prepare(
        `INSERT INTO Leaderboard (boat_id, total_points_event, event_id, place)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(boat_id, event_id) DO UPDATE SET total_points_event = excluded.total_points_event, place = excluded.place`,
      );
      temporaryTable.forEach((boat) => {
        updateQuery.run(boat.boat_id, boat.totalPoints, event_id, boat.place);
      });
      return { success: true };
    } catch (error) {
      console.error(
        'Error updating event leaderboard:',
        (error as Error).message,
      );
      throw error;
    }
  },
);

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
    penalty = null,
  ) => {
    try {
      console.log(
        `Updating race result in HeatRaceHandler for event_id: ${event_id}, race_id: ${race_id}, boat_id: ${boat_id}, new_position: ${new_position}, shift_positions: ${shift_positions}, heat_id: ${heat_id}, penalty: ${penalty}`,
      );

      // Get the current result for shifting purposes.
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

      // Update the score – if penalty is 'RDG', update only status.
      if (penalty === 'RDG') {
        const updateStatusOnlyQuery = db.prepare(
          `UPDATE Scores SET status = ? WHERE race_id = ? AND boat_id = ?`,
        );
        updateStatusOnlyQuery.run('RDG', race_id, boat_id);
      } else {
        const updateQuery = db.prepare(
          `UPDATE Scores SET position = ?, points = ?, status = ? WHERE race_id = ? AND boat_id = ?`,
        );
        const statusToUpdate = penalty || 'FINISHED';
        updateQuery.run(
          new_position,
          new_position,
          statusToUpdate,
          race_id,
          boat_id,
        );

        // Shift other boats if required.
        if (shift_positions) {
          if (currentPosition > new_position) {
            // Boat moved up - shift down others that have no penalty (status = 'FINISHED')
            const shiftQuery = db.prepare(
              `UPDATE Scores
               SET position = position + 1,
                   points = position + 1
               WHERE race_id = ?
                 AND position >= ?
                 AND position < ?
                 AND boat_id != ?
                 AND status = 'FINISHED'
                 AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
            );
            shiftQuery.run(
              race_id,
              new_position,
              currentPosition,
              boat_id,
              heat_id,
            );
          } else if (currentPosition < new_position) {
            // Boat moved down - shift up others that have no penalty
            const shiftQuery = db.prepare(
              `UPDATE Scores
               SET position = position - 1,
                   points = position - 1
               WHERE race_id = ?
                 AND position <= ?
                 AND position > ?
                 AND boat_id != ?
                 AND status = 'FINISHED'
                 AND race_id IN (SELECT race_id FROM Races WHERE heat_id = ?)`,
            );
            shiftQuery.run(
              race_id,
              new_position,
              currentPosition,
              boat_id,
              heat_id,
            );
          }
        }
      }

      // If a penalty (other than RDG) was applied and the heat is from the Final series,
      // immediately recalculate the final leaderboard.
      if (penalty && penalty !== 'RDG') {
        const heatInfo = db
          .prepare('SELECT heat_type FROM Heats WHERE heat_id = ?')
          .get(heat_id);
        if (heatInfo && heatInfo.heat_type === 'Final') {
          console.log(
            'Penalty applied in Final heat; recalculating final leaderboard...',
          );
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
          const updateFinalQuery = db.prepare(
            `INSERT INTO FinalLeaderboard (boat_id, total_points_final, event_id, placement_group, place)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(boat_id, event_id) DO UPDATE SET total_points_final = excluded.total_points_final, placement_group = excluded.placement_group, place = excluded.place`,
          );
          const temporaryTable = calculateFinalBoatScores(results, event_id);
          temporaryTable.forEach((boat) => {
            console.log('Updating FinalLeaderboard with:', boat);
            updateFinalQuery.run(
              boat.boat_id,
              boat.totalPoints,
              event_id,
              boat.placement_group,
              boat.place,
            );
          });
        }
      }

      return { success: true };
    } catch (err) {
      const error = err as Error;
      console.error('Error updating race result:', error.message);
      throw error;
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
        SUM(sc.points) AS total_raw_points,
        GROUP_CONCAT(
          CASE
            WHEN sc.status <> 'FINISHED'
              THEN '(' || sc.status || ') ' || sc.points
            ELSE sc.points
          END
          ORDER BY r.race_number
        ) AS race_positions,
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
    const temporaryTable = calculateFinalBoatScores(results, event_id);

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
        SUM(sc.points) AS total_raw_points,
        GROUP_CONCAT(
          CASE
            WHEN sc.status <> 'FINISHED'
              THEN '(' || sc.status || ') ' || sc.points
            ELSE sc.points
          END
          ORDER BY r.race_number
        ) AS race_positions,
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
      SELECT s.boat_id, s.points, r.race_number, h.heat_name, h.heat_id
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

ipcMain.handle('calculateAverageScores', async (event, event_id) => {
  try {
    // Calculate average for Qualifying series
    const qualifyingQuery = db.prepare(`
      SELECT s.boat_id, AVG(s.points) AS avgPointsQualifying
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ? AND h.heat_type = 'Qualifying'
      GROUP BY s.boat_id
    `);
    const qualifyingAverages = qualifyingQuery.all(event_id);

    // Calculate average for Final series
    const finalQuery = db.prepare(`
      SELECT s.boat_id, AVG(s.points) AS avgPointsFinal
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      WHERE h.event_id = ? AND h.heat_type = 'Final'
      GROUP BY s.boat_id
    `);
    const finalAverages = finalQuery.all(event_id);

    // Merge results by boat_id.
    const averages: {
      [boat_id: string]: {
        avgPointsQualifying: number | null;
        avgPointsFinal: number | null;
      };
    } = {};
    qualifyingAverages.forEach(
      (row: { boat_id: string | number; avgPointsQualifying: any }) => {
        averages[row.boat_id] = {
          avgPointsQualifying: row.avgPointsQualifying,
          avgPointsFinal: null,
        };
      },
    );
    finalAverages.forEach(
      (row: { boat_id: string | number; avgPointsFinal: number | null }) => {
        if (averages[row.boat_id]) {
          averages[row.boat_id].avgPointsFinal = row.avgPointsFinal;
        } else {
          averages[row.boat_id] = {
            avgPointsQualifying: null,
            avgPointsFinal: row.avgPointsFinal,
          };
        }
      },
    );
    return averages;
  } catch (error) {
    console.error('Error calculating average scores:', error);
    throw error;
  }
});

ipcMain.handle(
  'swapRaceResults',
  async (event, event_id, raceId, boat1_id, boat2_id) => {
    try {
      // Verify both boats have a score record for this race.
      const scoreQuery = db.prepare(
        'SELECT boat_id, position FROM Scores WHERE race_id = ? AND boat_id IN (?, ?)',
      );
      const scores = scoreQuery.all(raceId, boat1_id, boat2_id);
      if (scores.length < 2) {
        throw new Error(
          'Both boats must be recorded in the same race to swap.',
        );
      }
      const boat1Score = scores.find(
        (s: { boat_id: { toString: () => any } }) =>
          s.boat_id.toString() === boat1_id.toString(),
      );
      const boat2Score = scores.find(
        (s: { boat_id: { toString: () => any } }) =>
          s.boat_id.toString() === boat2_id.toString(),
      );
      if (!boat1Score || !boat2Score) {
        throw new Error('Boat scores not found.');
      }
      // Swap positions using two update statements.
      const updateQuery = db.prepare(
        'UPDATE Scores SET position = ? , points = ? WHERE race_id = ? AND boat_id = ?',
      );
      updateQuery.run(
        boat1Score.position,
        boat1Score.position,
        raceId,
        boat2_id,
      );
      updateQuery.run(
        boat2Score.position,
        boat2Score.position,
        raceId,
        boat1_id,
      );

      console.log(
        `Swapped race ${raceId} results between boat ${boat1_id} and boat ${boat2_id}.`,
      );
      return { success: true };
    } catch (error: any) {
      console.error('Error swapping race results:', error.message);
      throw error;
    }
  },
);

ipcMain.handle('updateRDGScores', async (event, event_id) => {
  try {
    const rdgScores = db
      .prepare(
        `
          SELECT s.*, b.boat_id as boatId, b.sail_number, b.model, b.country
          FROM Scores s
          JOIN Races r ON s.race_id = r.race_id
          JOIN Heats h ON r.heat_id = h.heat_id
          JOIN Boats b ON s.boat_id = b.boat_id
          WHERE h.event_id = ? AND s.status = 'RDG'
          `,
      )
      .all(event_id);
    console.log('RDG Scores with boat details:', rdgScores);

    // Retrieve unique boat IDs from the RDG scores.
    const boatIds = new Set(
      rdgScores.map((score: { boatId: any }) => score.boatId),
    );

    // Prepare a query to get all scores for a boat in the current event including heat_type.
    const boatScoresQuery = db.prepare(
      `
        SELECT s.*, r.race_number, h.heat_name, h.heat_type
        FROM Scores s
        JOIN Races r ON s.race_id = r.race_id
        JOIN Heats h ON r.heat_id = h.heat_id
        WHERE h.event_id = ? AND s.boat_id = ?
        `,
    );

    // For each boat, fetch its scores, group by heat type,
    // calculate the average points (for RDG scores) and update points only.
    boatIds.forEach((boatId) => {
      const boatScores = boatScoresQuery.all(event_id, boatId);
      console.log(`Boat (${boatId}) all scores:`, boatScores);

      // Separate scores by heat type and sort by race_number.
      const qualifyingScores = boatScores
        .filter((s: { heat_type: string }) => s.heat_type === 'Qualifying')
        .sort(
          (a: { race_number: number }, b: { race_number: number }) =>
            a.race_number - b.race_number,
        );
      const finalScores = boatScores
        .filter((s: { heat_type: string }) => s.heat_type === 'Final')
        .sort(
          (a: { race_number: number }, b: { race_number: number }) =>
            a.race_number - b.race_number,
        );

      // Prepare the update query to update only the points column.
      const updateQuery = db.prepare(
        'UPDATE Scores SET points = ? WHERE score_id = ?',
      );

      // Helper function to process segments for a given set of scores.
      const processSegments = (scoresArray: any[], heatLabel: string) => {
        for (let i = 0; i < scoresArray.length; i += 1) {
          if (scoresArray[i].status === 'RDG') {
            // For current RDG, use all scores before it (ignoring itself and any later scores).
            const segment = scoresArray.slice(0, i);
            if (segment.length > 0) {
              const sum = segment.reduce(
                (acc: number, s: any) => acc + s.points,
                0,
              );
              const avg = sum / segment.length;
              // Rounding to the nearest tenth (e.g. 3.42 -> 3.4, 3.45 -> 3.5).
              const adjusted = Math.round(avg * 10) / 10;
              updateQuery.run(adjusted, scoresArray[i].score_id);
              console.log(
                `Boat (${boatId}) ${heatLabel} RDG score for race ${scoresArray[i].race_id} computed average: ${avg.toFixed(
                  2,
                )}, adjusted to: ${adjusted}`,
              );
            }
          }
        }
      };

      // Process segments for both heat types.
      processSegments(qualifyingScores, 'Qualifying');
      processSegments(finalScores, 'Final');

      // For logging, calculate non-RDG averages using all scores not marked as 'RDG'
      const validQualifying = qualifyingScores.filter(
        (s: { status: string }) => s.status !== 'RDG',
      );
      const validFinal = finalScores.filter(
        (s: { status: string }) => s.status !== 'RDG',
      );
      const qualifyingAvg =
        validQualifying.length > 0
          ? validQualifying.reduce(
              (acc: number, s: { points: number }) => acc + s.points,
              0,
            ) / validQualifying.length
          : 0;
      const finalAvg =
        validFinal.length > 0
          ? validFinal.reduce(
              (acc: number, s: { points: number }) => acc + s.points,
              0,
            ) / validFinal.length
          : 0;
      console.log(
        `Boat (${boatId}) Qualifying non-RDG average:`,
        qualifyingAvg,
      );
      console.log(`Boat (${boatId}) Final non-RDG average:`, finalAvg);
    });

    return { success: true, rdgScores };
  } catch (error) {
    console.error('Error updating RDG scores:', error);
    throw error;
  }
});

ipcMain.handle('readAllScoresForEventQualifying', async (event, event_id) => {
  try {
    const query = `
      SELECT
        s.*,
        r.race_number,
        h.heat_name,
        h.heat_type,
        b.boat_id,
        b.sail_number,
        b.model,
        b.country
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      JOIN Boats b ON s.boat_id = b.boat_id
      WHERE h.event_id = ? AND h.heat_type = 'Qualifying'
      ORDER BY h.heat_name, r.race_number, s.boat_id
    `;
    const stmt = db.prepare(query);
    const results = stmt.all(event_id);
    return results;
  } catch (error) {
    console.error('Error reading all qualifying scores for event:', error);
    throw error;
  }
});

ipcMain.handle('readAllScoresForEventFinal', async (event, event_id) => {
  try {
    const query = `
      SELECT
        s.*,
        r.race_number,
        h.heat_name,
        h.heat_type,
        b.boat_id,
        b.sail_number,
        b.model,
        b.country
      FROM Scores s
      JOIN Races r ON s.race_id = r.race_id
      JOIN Heats h ON r.heat_id = h.heat_id
      JOIN Boats b ON s.boat_id = b.boat_id
      WHERE h.event_id = ? AND h.heat_type = 'Final'
      ORDER BY h.heat_name, r.race_number, s.boat_id
    `;
    const stmt = db.prepare(query);
    const results = stmt.all(event_id);
    return results;
  } catch (error) {
    console.error('Error reading all final scores for event:', error);
    throw error;
  }
});
