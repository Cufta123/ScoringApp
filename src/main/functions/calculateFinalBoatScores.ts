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

function getFinalScores(event_id: any, boat_id: any) {
  const scoresQuery = db.prepare(`
    SELECT points
    FROM Scores
    JOIN Races ON Scores.race_id = Races.race_id
    JOIN Heats ON Races.heat_id = Heats.heat_id
    WHERE Heats.event_id = ? AND Heats.heat_type = 'Final' AND Scores.boat_id = ?
    ORDER BY points DESC
  `);
  return scoresQuery
    .all(event_id, boat_id)
    .map((row: { points: any }) => row.points);
}
export default function calculateFinalBoatScores(
  results: Result[],
  event_id: any,
  pointsMap: Map<number, any[]>,
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

      // Determine the number of scores to exclude
      let excludeCount = 0;
      const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
      excludeCount = thresholds.filter(
        (threshold) => number_of_races >= threshold,
      ).length;
      console.log(
        `Boat ID: ${boat_id}, Number of Races: ${number_of_races}, Places to Exclude: ${excludeCount}`,
      );

      // Exclude the worst scores
      const initialTotalPoints = scores.reduce(
        (acc: any, score: any) => acc + score,
        0,
      );
      const worstPlaces = scores.slice(0, excludeCount);
      const scoresToInclude = scores.slice(excludeCount);
      const totalPoints = scoresToInclude.reduce(
        (acc: any, score: any) => acc + score,
        0,
      );
      console.log(
        `Boat ID: ${boat_id}, Number of Races: ${number_of_races}, Initial Total Points: ${initialTotalPoints}, Worst Places: ${worstPlaces}`,
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

    // Sort boats by total points and assign places
    const sortedBoats = Array.from(groupPointsMap.entries()).sort(
      ([pointsA], [pointsB]) => pointsA - pointsB,
    );

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
          const scoresToInclude = scores.slice(excludeCount);
          return {
            boat_id,
            scores: scoresToInclude.sort((a: number, b: number) => a - b),
          };
        });

        // A81.1 Sort the boats based on their scores
        sortedScores.sort((a, b) => {
          for (
            let i = 0;
            i < Math.min(a.scores.length, b.scores.length);
            i += 1
          ) {
            if (a.scores[i] !== b.scores[i]) {
              return a.scores[i] - b.scores[i]; // Compare scores in ascending order
            }
          }
          return 0; // If all scores are the same, keep the original order
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

          console.log(
            `Tie detected between Boat ${a.boat_id} and Boat ${b.boat_id}. Applying tie-breaking logic.`,
          );

          const scoresA = getFinalScores(event_id, a.boat_id); // Retrieve original scores for boat A
          const scoresB = getFinalScores(event_id, b.boat_id); // Retrieve original scores for boat B

          const maxLength = Math.max(scoresA.length, scoresB.length);
          for (let i = 1; i <= maxLength; i += 1) {
            const scoreA =
              scoresA[scoresA.length - i] ?? Number.MAX_SAFE_INTEGER;
            const scoreB =
              scoresB[scoresB.length - i] ?? Number.MAX_SAFE_INTEGER;
            console.log(
              `Comparing race ${i}: Boat ${a.boat_id} score: ${scoreA}, Boat ${b.boat_id} score: ${scoreB}`,
            );
            if (scoreA !== scoreB) {
              console.log(
                `Tie-breaking: Comparing scores from the last race backward. Boat ${a.boat_id} score: ${scoreA}, Boat ${b.boat_id} score: ${scoreB}`,
              );
              return scoreA - scoreB; // Compare scores from the last race backward
            }
          }
          return 0; // If all scores are the same, keep the original order
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
