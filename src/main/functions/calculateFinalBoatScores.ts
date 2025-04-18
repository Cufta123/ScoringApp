/* eslint-disable no-console */
/* eslint-disable camelcase */
import { db } from '../../../public/Database/DBManager';

interface Result {
  heat_name: any;
  boat_id: any;
  total_points_final: any;
  number_of_races: any;
  placement_group: string;
}

interface TemporaryTableEntry {
  boat_id: string;
  totalPoints: number;
  place: number;
  placement_group: string;
}

// Helper: Get qualifying leaderboard for all boats in this event
function getQualifyingLeaderboard(event_id: any): Record<string, number> {
  const query = db.prepare(`
    SELECT boat_id, total_points_event
    FROM Leaderboard
    WHERE event_id = ?
  `);
  const rows = query.all(event_id);
  const map: Record<string, number> = {};
  rows.forEach((row: any) => {
    map[row.boat_id] = Number(row.total_points_event);
  });
  return map;
}

// Update getFinalScores to order by race_number ascending
function getFinalScores(event_id: any, boat_id: any) {
  const scoresQuery = db.prepare(`
    SELECT s.points, s.status, r.race_number
    FROM Scores s
    JOIN Races r ON s.race_id = r.race_id
    JOIN Heats h ON r.heat_id = h.heat_id
    WHERE h.event_id = ?
      AND h.heat_type = 'Final'
      AND s.boat_id = ?
    ORDER BY r.race_number ASC
  `);
  return scoresQuery.all(event_id, boat_id);
}

function getSailNumber(boat_id: any): string {
  const row = db
    .prepare('SELECT sail_number FROM Boats WHERE boat_id = ?')
    .get(boat_id);
  return row ? row.sail_number : String(boat_id);
}

export default function calculateFinalBoatScores(
  results: Result[],
  event_id: any,
): TemporaryTableEntry[] {
  // Log each result to check the placement_group property
  results.forEach((result, index) => {
    console.log(`Result ${index}:`, result);
  });

  // Group results by placement group using heat_name
  const groupedResults = results.reduce(
    (acc, result) => {
      const placement_group = result.heat_name; // Use heat_name as placement_group
      if (!acc[placement_group]) {
        acc[placement_group] = [];
      }
      acc[placement_group].push(result);
      return acc;
    },
    {} as Record<string, Result[]>,
  );

  console.log('Grouped Results:', groupedResults);

  // Fetch qualifying leaderboard once
  const qualifyingPointsMap = getQualifyingLeaderboard(event_id);

  let finalTemporaryTable: TemporaryTableEntry[] = [];

  // Process each placement group separately
  Object.entries(groupedResults).forEach(([placement_group, groupResults]) => {
    console.log(`Processing placement group: ${placement_group}`);
    const groupPointsMap = new Map<number, string[]>();
    const temporaryTable: TemporaryTableEntry[] = [];

    groupResults.forEach((result) => {
      const { boat_id, number_of_races } = result;

      // Fetch all final scores for the boat
      const scores = getFinalScores(event_id, boat_id);

      // Determine the number of scores to exclude
      const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
      const excludeCount = thresholds.filter(
        (threshold) => number_of_races >= threshold,
      ).length;

      // Include all scores (even if status is 'DNE') and convert points to numbers.
      const scoresWithPenalty = scores.map((s: any) => ({
        ...s,
        points: Number(s.points),
      }));

      // For logging purposes, compute the initial total points (all scores included)
      const initialTotalPoints = scoresWithPenalty.reduce(
        (acc: any, s: { points: any }) => acc + s.points,
        0,
      );
      console.log(
        `Boat ID: ${boat_id}, Initial Total Points (all scores): ${initialTotalPoints}`,
      );

      // Sort descending: worst (highest points) first
      scoresWithPenalty.sort(
        (a: { points: number }, b: { points: number }) => b.points - a.points,
      );

      // Exclude only non-DNE scores. DNE scores are never excluded.
      const reducedResult = scoresWithPenalty.reduce(
        (
          acc: { countExcluded: number; scoresToInclude: any },
          score: { status: string },
        ) => {
          if (acc.countExcluded < excludeCount && score.status !== 'DNE') {
            return {
              countExcluded: acc.countExcluded + 1,
              scoresToInclude: acc.scoresToInclude,
            };
          }
          return {
            countExcluded: acc.countExcluded,
            scoresToInclude: [...acc.scoresToInclude, score],
          };
        },
        { countExcluded: 0, scoresToInclude: [] as typeof scoresWithPenalty },
      );
      const { scoresToInclude } = reducedResult;
      const totalPoints = scoresToInclude.reduce(
        (acc: any, s: { points: any }) => acc + s.points,
        0,
      );
      console.log(
        `Boat ID: ${boat_id}, Total Points After Exclusion: ${totalPoints}`,
      );

      if (!groupPointsMap.has(totalPoints)) {
        groupPointsMap.set(totalPoints, []);
      }
      const boats = groupPointsMap.get(totalPoints);
      if (boats) {
        boats.push(boat_id);
      }
    });

    // Create a temporary table with all boats and their total points
    groupPointsMap.forEach((boats, totalPoints) => {
      boats.forEach((boat_id) => {
        temporaryTable.push({
          boat_id,
          totalPoints,
          placement_group,
          place: 0, // Initialize place with a default value
        });
      });
    });

    // --- Build combined points list for all boats in this group ---
    const combinedPointsList = temporaryTable.map((entry) => ({
      ...entry,
      combinedPoints:
        (qualifyingPointsMap[entry.boat_id] ?? 0) + entry.totalPoints,
    }));

    // --- Sort by combined points ---
    combinedPointsList.sort((a, b) => a.combinedPoints - b.combinedPoints);

    // --- Assign places based on combined points ---
    combinedPointsList.forEach((boat, index) => {
      boat.place = index + 1;
    });

    // --- Check for ties in combined points ---
    const ties: Record<number, string[]> = {};
    combinedPointsList.forEach((boat) => {
      if (!ties[boat.combinedPoints]) ties[boat.combinedPoints] = [];
      ties[boat.combinedPoints].push(boat.boat_id);
    });

    // --- For each tie, apply detailed tie-breaking logic ---
    Object.entries(ties).forEach(([combinedPoints, boatIds]) => {
      if (boatIds.length > 1) {
        // Log when a tie is detected
        console.log(
          `TIE detected in group "${placement_group}" for combinedPoints=${combinedPoints}: Boats [${boatIds.map((id) => `${getSailNumber(id)} (id:${id})`).join(', ')}]`,
        );

        // --- Qualifying heats and scores logging ---
        // 1. Get all qualifying heats for this event
        const qualifyingHeats = db
          .prepare(
            `
          SELECT h.heat_id, h.heat_name
          FROM Heats h
          WHERE h.event_id = ? AND h.heat_type = 'Qualifying'
        `,
          )
          .all(event_id);

        // 2. For each heat, find which boats from the tie group participated
        const heatBoatMap: Record<string, Set<string>> = {};
        qualifyingHeats.forEach((heat: any) => {
          const boatRows = db
            .prepare(
              `
            SELECT DISTINCT s.boat_id
            FROM Scores s
            JOIN Races r ON s.race_id = r.race_id
            WHERE r.heat_id = ?
          `,
            )
            .all(heat.heat_id);
          heatBoatMap[heat.heat_id] = new Set(
            boatRows.map((row: any) => row.boat_id),
          );
        });

        // 3. Find heats where all tied boats participated
        const commonQualHeats = Object.entries(heatBoatMap)
          .filter(([_, boatSet]) => boatIds.every((id) => boatSet.has(id)))
          .map(([heat_id]) => heat_id);

        console.log(
          `  Qualifying heats where all tied boats [${boatIds.join(', ')}] competed together:`,
          commonQualHeats,
        );

        // 4. For each tied boat, fetch their scores in those heats
        boatIds.forEach((boat_id) => {
          const scores = db
            .prepare(
              `
            SELECT s.points, s.status, r.race_number, r.heat_id
            FROM Scores s
            JOIN Races r ON s.race_id = r.race_id
            WHERE r.heat_id IN (${commonQualHeats.map(() => '?').join(',')})
              AND s.boat_id = ?
            ORDER BY r.heat_id, r.race_number
          `,
            )
            .all(...commonQualHeats, boat_id);

          console.log(
            `    Boat ${getSailNumber(boat_id)} (id:${boat_id}) qualifying scores in common heats:`,
            scores.map((s: any) => `heat ${s.heat_id}: ${s.points}`),
          );
        });
        // --- End of qualifying heats/scores logging ---

        // Log the scores for each tied boat before sorting
        boatIds.forEach((boat_id) => {
          const scores = getFinalScores(event_id, boat_id);
          console.log(
            `  Boat ${boat_id} raw final scores:`,
            scores.map((s: { points: any }) => s.points),
          );
        });

        // Only apply detailed tie-breaking if there is a tie
        const sortedScores = boatIds
          .map((boat_id) => {
            const scores = getFinalScores(event_id, boat_id);
            const number_of_races =
              groupResults.find(
                (result: { boat_id: string }) => result.boat_id === boat_id,
              )?.number_of_races || 0;
            const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
            const excludeCount = thresholds.filter(
              (threshold) => number_of_races >= threshold,
            ).length;
            const scoresToInclude = scores
              .slice(excludeCount)
              .map((s: any) => ({
                ...s,
                points: Number(s.points),
              }));
            // Log included scores after exclusion
            console.log(
              `  Boat ${boat_id} included scores after exclusion:`,
              scoresToInclude.map((s: { points: any }) => s.points),
            );
            return {
              boat_id,
              scores: scoresToInclude.sort(
                (a: { points: number }, b: { points: number }) =>
                  a.points - b.points,
              ),
            };
          })
          .sort((a, b) => {
            // Included scores comparison
            const resultA = groupResults.find(
              (result: { boat_id: string }) => result.boat_id === a.boat_id,
            );
            const resultB = groupResults.find(
              (result: { boat_id: string }) => result.boat_id === b.boat_id,
            );
            const number_of_racesA = resultA?.number_of_races || 0;
            const number_of_racesB = resultB?.number_of_races || 0;
            const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
            const excludeCountA = thresholds.filter(
              (threshold) => number_of_racesA >= threshold,
            ).length;
            const excludeCountB = thresholds.filter(
              (threshold) => number_of_racesB >= threshold,
            ).length;

            // 1. Get all raw final scores for both boats (no exclusion)
            const rawFinalScoresA = getFinalScores(event_id, a.boat_id).map(
              (s: any) => Number(s.points),
            );
            const rawFinalScoresB = getFinalScores(event_id, b.boat_id).map(
              (s: any) => Number(s.points),
            );

            // 2. Get all qualifying scores from common heats for both boats
            const qualScoresA = db
              .prepare(
                `
    SELECT s.points
    FROM Scores s
    JOIN Races r ON s.race_id = r.race_id
    WHERE r.heat_id IN (${commonQualHeats.map(() => '?').join(',')})
      AND s.boat_id = ?
    ORDER BY r.heat_id, r.race_number
  `,
              )
              .all(...commonQualHeats, a.boat_id)
              .map((s: any) => Number(s.points));

            const qualScoresB = db
              .prepare(
                `
    SELECT s.points
    FROM Scores s
    JOIN Races r ON s.race_id = r.race_id
    WHERE r.heat_id IN (${commonQualHeats.map(() => '?').join(',')})
      AND s.boat_id = ?
    ORDER BY r.heat_id, r.race_number
  `,
              )
              .all(...commonQualHeats, b.boat_id)
              .map((s: any) => Number(s.points));

            // 3. Merge all raw qualifying and final scores, then sort
            const allRawScoresA = [...qualScoresA, ...rawFinalScoresA].sort(
              (x, y) => x - y,
            );
            const allRawScoresB = [...qualScoresB, ...rawFinalScoresB].sort(
              (x, y) => x - y,
            );

            // 4. Log the merged arrays for clarity
            console.log(
              `    Comparing combined (qual+final) RAW scores: Boat ${a.boat_id} [${allRawScoresA}] vs Boat ${b.boat_id} [${allRawScoresB}]`,
            );

            // 5. Compare the merged arrays
            for (
              let i = 0;
              i < Math.max(allRawScoresA.length, allRawScoresB.length);
              i += 1
            ) {
              const scoreA = allRawScoresA[i] ?? Number.MAX_SAFE_INTEGER;
              const scoreB = allRawScoresB[i] ?? Number.MAX_SAFE_INTEGER;
              if (scoreA !== scoreB) {
                return scoreA - scoreB;
              }
            }
            // Raw race scores fallback
            const rawScoresA = getFinalScores(event_id, a.boat_id)
              .map((s: any) => ({ ...s, points: Number(s.points) }))
              .sort((s1: any, s2: any) => s2.race_number - s1.race_number)
              .map((s: any) => s.points);
            const rawScoresB = getFinalScores(event_id, b.boat_id)
              .map((s: any) => ({ ...s, points: Number(s.points) }))
              .sort((s1: any, s2: any) => s2.race_number - s1.race_number)
              .map((s: any) => s.points);

            // Log fallback comparison
            console.log(
              `    Fallback: Comparing raw scores: Boat ${a.boat_id} [${rawScoresA}] vs Boat ${b.boat_id} [${rawScoresB}]`,
            );

            for (
              let i = 0;
              i < Math.max(rawScoresA.length, rawScoresB.length);
              i += 1
            ) {
              const ptA = rawScoresA[i] ?? Number.MAX_SAFE_INTEGER;
              const ptB = rawScoresB[i] ?? Number.MAX_SAFE_INTEGER;
              if (ptA !== ptB) {
                return ptA - ptB;
              }
            }
            return 0;
          });

        // Log sorted order after tie-breaking
        console.log(
          `  Sorted order after tie-breaking: [${sortedScores.map((b) => b.boat_id).join(', ')}]`,
        );

        const tiedIndices = combinedPointsList
          .map((b, idx) => (boatIds.includes(b.boat_id) ? idx : -1))
          .filter((idx) => idx !== -1);
        const minPlace = Math.min(
          ...tiedIndices.map((idx) => combinedPointsList[idx].place),
        );

        // Assign new places in sorted order
        sortedScores.forEach((boat, idx) => {
          const indexInCombined = combinedPointsList.findIndex(
            (b) => b.boat_id === boat.boat_id,
          );
          if (indexInCombined !== -1) {
            combinedPointsList[indexInCombined].place = minPlace + idx;
          }
        });
      }
    });

    // --- Copy back places to temporaryTable for output ---
    temporaryTable.forEach((boat) => {
      const combined = combinedPointsList.find(
        (b) => b.boat_id === boat.boat_id,
      );
      if (combined) {
        boat.place = combined.place;
      }
    });

    // Log the temporary table with places after tie-breaking
    console.log(
      `Temporary Table with Places after tie-breaking for group ${placement_group}:`,
      temporaryTable,
    );

    // Merge the temporary table for this group into the final temporary table
    finalTemporaryTable = finalTemporaryTable.concat(temporaryTable);
  });

  return finalTemporaryTable;
}
