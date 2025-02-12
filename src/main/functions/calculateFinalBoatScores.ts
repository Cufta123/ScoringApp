/* eslint-disable camelcase */
import { db } from '../../../public/Database/DBManager';

interface Result {
  boat_id: any;
  total_points_final: any;
  heat_name: any;
}

interface TemporaryTableEntry {
  boat_id: string;
  totalPoints: number;
  place?: number;
}

function getScoresForA81(event_id: any, boat_id: any) {
  const scoresQuery = db.prepare(`
    SELECT points
    FROM Scores
    JOIN Races ON Scores.race_id = Races.race_id
    JOIN Heats ON Races.heat_id = Heats.heat_id
    WHERE Heats.event_id = ? AND Scores.boat_id = ?
    ORDER BY points DESC
  `);
  return scoresQuery
    .all(event_id, boat_id)
    .map((row: { points: any }) => row.points);
}

function getScoresForA82(event_id: any, boat_id: any) {
  const scoresQuery = db.prepare(`
    SELECT s.points
    FROM Scores s
    JOIN Races r ON s.race_id = r.race_id
    JOIN Heats h ON r.heat_id = h.heat_id
    WHERE h.event_id = ? AND s.boat_id = ?
    ORDER BY r.race_number DESC
  `);

  return scoresQuery
    .all(event_id, boat_id)
    .map((row: { points: any }) => row.points);
}

export default function calculateFinalBoatScores(
  results: Result[],
  event_id: any,
): Map<string, TemporaryTableEntry[]> {
  const groupTables = new Map<string, TemporaryTableEntry[]>();

  results.forEach((result) => {
    const { boat_id, heat_name } = result;
    const groupName = heat_name.split(' ')[1]; // Extract the group name (e.g., Gold, Silver)

    if (!groupTables.has(groupName)) {
      groupTables.set(groupName, []);
    }

    const scores = getScoresForA81(event_id, boat_id);
    const totalPoints = scores.reduce((acc: any, score: any) => acc + score, 0);

    groupTables.get(groupName)?.push({ boat_id, totalPoints });
  });

  groupTables.forEach((table, groupName) => {
    table.sort((a, b) => a.totalPoints - b.totalPoints);

    table.forEach((boat, index) => {
      boat.place = index + 1;
    });

    const boatsWithSamePoints = table.reduce(
      (acc, boat) => {
        if (!acc[boat.totalPoints]) {
          acc[boat.totalPoints] = [];
        }
        acc[boat.totalPoints].push(boat.boat_id);
        return acc;
      },
      {} as Record<number, string[]>,
    );

    Object.entries(boatsWithSamePoints).forEach(([totalPoints, boatIds]) => {
      if (boatIds.length > 1) {
        const sortedScores = boatIds.map((boat_id) => {
          const scores = getScoresForA81(event_id, boat_id);
          return {
            boat_id,
            scores: scores.sort((a: number, b: number) => a - b),
          };
        });

        sortedScores.sort((a, b) => {
          for (
            let i = 0;
            i < Math.min(a.scores.length, b.scores.length);
            i += 1
          ) {
            if (a.scores[i] !== b.scores[i]) {
              return a.scores[i] - b.scores[i];
            }
          }
          return 0;
        });

        sortedScores.sort((a, b) => {
          const initialComparison = a.scores.reduce(
            (acc: number, score: number, index: number) => {
              if (acc !== 0) return acc;
              return score - (b.scores[index] ?? Number.MAX_SAFE_INTEGER);
            },
            0,
          );

          if (initialComparison !== 0) return initialComparison;

          const scoresA = getScoresForA82(event_id, a.boat_id);
          const scoresB = getScoresForA82(event_id, b.boat_id);

          const maxLength = Math.max(scoresA.length, scoresB.length);
          for (let i = 1; i <= maxLength; i += 1) {
            const scoreA =
              scoresA[scoresA.length - i] ?? Number.MAX_SAFE_INTEGER;
            const scoreB =
              scoresB[scoresB.length - i] ?? Number.MAX_SAFE_INTEGER;
            if (scoreA !== scoreB) {
              return scoreA - scoreB;
            }
          }
          return 0;
        });

        sortedScores.forEach((boat, index) => {
          const boatIndex = table.findIndex((b) => b.boat_id === boat.boat_id);
          if (boatIndex !== -1) {
            table[boatIndex].place = index + 1;
          }
        });

        table.sort((a, b) => {
          if (a.totalPoints === b.totalPoints) {
            return (a.place ?? 0) - (b.place ?? 0);
          }
          return a.totalPoints - b.totalPoints;
        });

        table.forEach((boat, index) => {
          boat.place = index + 1;
        });
      }
    });
  });

  return groupTables;
}
