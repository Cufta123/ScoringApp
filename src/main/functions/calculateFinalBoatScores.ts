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
      console.log('Scores and boat_ID', scores, boat_id);

      // Determine the number of scores to exclude
      const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
      const excludeCount = thresholds.filter(
        (threshold) => number_of_races >= threshold,
      ).length;
      console.log(
        `Boat ID: ${boat_id}, Number of Races: ${number_of_races}, Places to Exclude: ${excludeCount}`,
      );

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

    // Sort the temporary table by total points
    temporaryTable.sort((a, b) => a.totalPoints - b.totalPoints);

    // Assign places based on the sorted order
    temporaryTable.forEach((boat, index) => {
      if (boat.placement_group === placement_group) {
        boat.place = index + 1;
      }
    });

    // Log the temporary table with places before tie-breaking
    console.log(
      `Temporary Table with Places before tie-breaking for group ${placement_group}:`,
      temporaryTable,
    );

    // Identify boats with the same total points
    const boatsWithSamePoints = temporaryTable.reduce(
      (acc, boat) => {
        if (boat.placement_group === placement_group) {
          if (!acc[boat.totalPoints]) {
            acc[boat.totalPoints] = [];
          }
          acc[boat.totalPoints].push(boat.boat_id);
        }
        return acc;
      },
      {} as Record<number, string[]>,
    );

    // Fetch and display all scores for boats with the same total points
    Object.entries(boatsWithSamePoints).forEach(([totalPoints, boatIds]) => {
      if (boatIds.length > 1) {
        console.log(`Boats with total points ${totalPoints}:`, boatIds);
        const sortedScores = boatIds.map((boat_id) => {
          const scores = getFinalScores(event_id, boat_id);
          const number_of_races =
            groupResults.find(
              (result: { boat_id: string }) => result.boat_id === boat_id,
            )?.number_of_races || 0;
          const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
          const excludeCount = thresholds.filter(
            (threshold) => number_of_races >= threshold,
          ).length;
          const scoresToInclude = scores.slice(excludeCount).map((s: any) => ({
            ...s,
            points: Number(s.points),
          }));
          return {
            boat_id,
            scores: scoresToInclude.sort(
              (a: { points: number }, b: { points: number }) =>
                a.points - b.points,
            ),
          };
        });

        // A81.1 Sort the boats based on their scores using default tie-breaking logic
        sortedScores.sort((a, b) => {
          // Retrieve the number of races for both boats
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

          // Compute the scores each boat includes (after exclusion)
          const includedScoresA = getFinalScores(event_id, a.boat_id)
            .slice(excludeCountA)
            .map((s: any) => ({ ...s, points: Number(s.points) }))
            .sort((x: any, y: any) => x.points - y.points);
          const includedScoresB = getFinalScores(event_id, b.boat_id)
            .slice(excludeCountB)
            .map((s: any) => ({ ...s, points: Number(s.points) }))
            .sort((x: any, y: any) => x.points - y.points);

          console.log(
            `Scores for boat ${a.boat_id} (sorted):`,
            includedScoresA.map((score: any) => score.points),
          );
          console.log(
            `Scores for boat ${b.boat_id} (sorted):`,
            includedScoresB.map((score: any) => score.points),
          );

          // Compare the included scores one by one
          for (
            let i = 0;
            i < Math.max(includedScoresA.length, includedScoresB.length);
            i += 1
          ) {
            const scoreA =
              includedScoresA[i]?.points ?? Number.MAX_SAFE_INTEGER;
            const scoreB =
              includedScoresB[i]?.points ?? Number.MAX_SAFE_INTEGER;
            if (scoreA !== scoreB) {
              console.log(
                `Tie broken between boat ${a.boat_id} and boat ${b.boat_id}: Boat ${
                  scoreA < scoreB ? a.boat_id : b.boat_id
                } wins by included scores comparison`,
              );
              return scoreA - scoreB;
            }
          }

          console.log(
            `No difference found between boat ${a.boat_id} and boat ${b.boat_id} in included scores. Falling back to raw race scores.`,
          );

          // Fall back: compare using raw race scores (last race first)
          const rawScoresA = getFinalScores(event_id, a.boat_id)
            .map((s: any) => ({ ...s, points: Number(s.points) }))
            .sort((s1: any, s2: any) => s2.race_number - s1.race_number)
            .map((s: any) => s.points);
          const rawScoresB = getFinalScores(event_id, b.boat_id)
            .map((s: any) => ({ ...s, points: Number(s.points) }))
            .sort((s1: any, s2: any) => s2.race_number - s1.race_number)
            .map((s: any) => s.points);

          for (
            let i = 0;
            i < Math.max(rawScoresA.length, rawScoresB.length);
            i += 1
          ) {
            const ptA = rawScoresA[i] ?? Number.MAX_SAFE_INTEGER;
            const ptB = rawScoresB[i] ?? Number.MAX_SAFE_INTEGER;
            console.log(
              `Race comparison at index ${i} (i.e., race ${i + 1} from last): Boat ${a.boat_id} score: ${ptA}, Boat ${b.boat_id} score: ${ptB}`,
            );
            if (ptA !== ptB) {
              console.log(
                `Tie broken between boat ${a.boat_id} and boat ${b.boat_id} using raw race scores (last race first): Boat ${
                  ptA < ptB ? a.boat_id : b.boat_id
                } wins this comparison`,
              );
              return ptA - ptB;
            }
          }
          return 0;
        });

        sortedScores.forEach((boat, index) => {
          const boatIndex = temporaryTable.findIndex(
            (b) => b.boat_id === boat.boat_id,
          );
          if (boatIndex !== -1) {
            temporaryTable[boatIndex].place = index + 1; // Update place based on sorted order
          }
        });
        temporaryTable.sort((a, b) => {
          if (a.totalPoints === b.totalPoints) {
            return (a.place ?? 0) - (b.place ?? 0);
          }
          return a.totalPoints - b.totalPoints;
        });

        // Update places in the temporary table based on sorted order
        temporaryTable.forEach((boat, index) => {
          if (boat.placement_group === placement_group) {
            boat.place = index + 1;
          }
        });

        console.log(
          `After tie-breaking for total points ${totalPoints}:`,
          sortedScores,
        );
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
