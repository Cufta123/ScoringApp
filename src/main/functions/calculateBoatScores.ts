/* eslint-disable no-console */
/* eslint-disable camelcase */

export interface SummaryResult {
  boat_id: string;
  total_points_event: number;
  number_of_races: number;
}

export interface RawScore {
  boat_id: string;
  points: number;
  race_number: number;
  heat_name: string;
  heat_id: number;
  status: string; // <-- new field added
}

export interface TemporaryTableEntry {
  boat_id: string;
  totalPoints: number;
  place?: number;
}

/**
 * Given the summary data and all raw scores for the event,
 * calculate the temporary leaderboard with tie‐breaking.
 *
 * @param summaryResults - Array of summary results per boat.
 * @param rawScores - Array of all scores for the event.
 * @param finalSeries - Optional flag that if true (for final series ranking)
 *                      excludes one additional (i.e. second worst) race score.
 * @returns An array of TemporaryTableEntry with calculated total points and place.
 */
export default function calculateBoatScores(
  summaryResults: SummaryResult[],
  rawScores: RawScore[],
  finalSeries: boolean = false,
): TemporaryTableEntry[] {
  // Build a map for each boat to its scores for tie-breaking.
  // Two maps are created:
  // - boatScoresByPoints: sorted descending by points (for exclusion calculation)
  // - boatScoresByRace: sorted descending by race_number (for tie-breaking)
  const boatScoresByPoints = new Map<
    string,
    { points: number; heat_name: string; heat_id: number; status: string }[]
  >();
  const boatScoresByRace = new Map<
    string,
    { points: number; heat_name: string; heat_id: number; status: string }[]
  >();

  // Initialize maps for all boats from summaryResults.
  summaryResults.forEach((result) => {
    boatScoresByPoints.set(result.boat_id, []);
    boatScoresByRace.set(result.boat_id, []);
  });

  // Populate the maps using the rawScores.
  rawScores.forEach((score) => {
    if (boatScoresByPoints.has(score.boat_id)) {
      // For points-based ordering, we want scores sorted descending.
      boatScoresByPoints.get(score.boat_id)!.push({
        points: Number(score.points),
        heat_name: score.heat_name,
        heat_id: score.heat_id,
        status: score.status,
      });
      // For race-based (tie-break) ordering, assume rawScores came in order of race_number descending.
      boatScoresByRace.get(score.boat_id)!.push({
        points: Number(score.points),
        heat_name: score.heat_name,
        heat_id: score.heat_id,
        status: score.status,
      });
    }
  });

  // Optionally sort each boat's scores if not already in proper order.
  boatScoresByPoints.forEach((scores, boat_id) => {
    // sort descending: highest points first
    scores.sort((a, b) => Number(b.points) - Number(a.points));
    boatScoresByPoints.set(boat_id, scores);
  });
  // For tie-breaking we assume the rawScores are delivered as needed.
  boatScoresByRace.forEach((scores, boat_id) => {
    boatScoresByRace.set(boat_id, scores);
  });

  // Calculate each boat's total points after exclusion.
  // The exclusion rule: count the number of thresholds (4, 8, 16, …) met by number_of_races.
  const thresholds = [4, 8, 16, 24, 32, 40, 48, 56, 64, 72];
  const temporaryTable: TemporaryTableEntry[] = [];

  summaryResults.forEach((result) => {
    const { boat_id, number_of_races } = result;
    const scores = boatScoresByPoints.get(boat_id) || [];
    let excludeCount = thresholds.filter(
      (threshold) => number_of_races >= threshold,
    ).length;
    if (finalSeries) {
      excludeCount += 1;
    }
    // Exclude only scores that don't have status "DNE"
    const { scoresToInclude } = scores.reduce(
      (
        acc: {
          excludedCount: number;
          scoresToInclude: {
            points: number;
            heat_name: string;
            heat_id: number;
            status: string;
          }[];
        },
        score,
      ) => {
        if (acc.excludedCount < excludeCount && score.status !== 'DNE') {
          return {
            excludedCount: acc.excludedCount + 1,
            scoresToInclude: acc.scoresToInclude,
          };
        }
        acc.scoresToInclude.push({ ...score, points: Number(score.points) });
        return acc;
      },
      { excludedCount: 0, scoresToInclude: [] },
    );
    // Sum points making sure they are numbers.
    const totalPoints = scoresToInclude.reduce(
      (acc: number, score) => acc + Number(score.points),
      0,
    );
    temporaryTable.push({ boat_id, totalPoints });
  });

  // Sort by total points ascending (i.e. lower totalPoints is better).
  temporaryTable.sort((a, b) => Number(a.totalPoints) - Number(b.totalPoints));
  // Assign initial places.
  temporaryTable.forEach((boat, index) => {
    boat.place = index + 1;
  });

  // --- Tie-breaking ---
  const grouped: Record<number, TemporaryTableEntry[]> = {};
  temporaryTable.forEach((entry) => {
    if (!grouped[entry.totalPoints]) grouped[entry.totalPoints] = [];
    grouped[entry.totalPoints].push(entry);
  });

  // For any group with more than one boat, apply tie-breaking logic.
  Object.keys(grouped).forEach((totalPointsKey) => {
    const group = grouped[Number(totalPointsKey)];
    if (group.length > 1) {
      // Retrieve and log races where tied boats competed together
      const tiedBoats = group.map((entry) => entry.boat_id);
      const racesTogether: { [heat_id: number]: string[] } = {};

      rawScores.forEach((score) => {
        if (tiedBoats.includes(score.boat_id)) {
          if (!racesTogether[score.heat_id]) {
            racesTogether[score.heat_id] = [];
          }
          racesTogether[score.heat_id].push(score.boat_id);
        }
      });

      // Check if tied boats have common heats
      const commonHeats = Object.keys(racesTogether).filter(
        (heatId) => racesTogether[Number(heatId)].length > 1,
      );

      if (commonHeats.length > 0) {
        // Use scores from common heats to break the tie
        const scoresByBoat: { [boat_id: string]: number[] } = {};
        commonHeats.forEach((heatIdStr) => {
          const heatId = Number(heatIdStr);
          const boatsInHeat = racesTogether[heatId];
          boatsInHeat.forEach((boat_id) => {
            const scores = boatScoresByRace.get(boat_id) || [];
            // Filter and sort scores in ascending order
            const scoresInHeat = scores
              .filter((score) => score.heat_id === heatId)
              .sort((a, b) => Number(a.points) - Number(b.points));
            if (!scoresByBoat[boat_id]) {
              scoresByBoat[boat_id] = [];
            }
            scoresByBoat[boat_id].push(
              ...scoresInHeat.map((score) => Number(score.points)),
            );
          });
        });

        // Sort the scores for each boat from best to worst (ascending order)
        Object.keys(scoresByBoat).forEach((boat_id) => {
          scoresByBoat[boat_id].sort((a, b) => a - b);
        });

        // Update the places for the boats in this group using the sorted scores
        group.sort((a, b) => {
          const scoresA = scoresByBoat[a.boat_id] || [];
          const scoresB = scoresByBoat[b.boat_id] || [];
          for (
            let i = 0;
            i < Math.max(scoresA.length, scoresB.length);
            i += 1
          ) {
            const scoreA = scoresA[i] ?? Number.MAX_SAFE_INTEGER;
            const scoreB = scoresB[i] ?? Number.MAX_SAFE_INTEGER;
            if (scoreA !== scoreB) return scoreA - scoreB;
          }
          return 0;
        });
      } else {
        // Use default tie-breaking logic based on race order.
        group.sort((a, b) => {
          const scoresA = boatScoresByRace.get(a.boat_id) || [];
          const scoresB = boatScoresByRace.get(b.boat_id) || [];
          const maxLength = Math.max(scoresA.length, scoresB.length);
          // Compare from the last race backward.
          for (let i = 1; i <= maxLength; i += 1) {
            const scoreA = Number(
              scoresA[scoresA.length - i]?.points ?? Number.MAX_SAFE_INTEGER,
            );
            const scoreB = Number(
              scoresB[scoresB.length - i]?.points ?? Number.MAX_SAFE_INTEGER,
            );
            if (scoreA !== scoreB) return scoreA - scoreB;
          }
          return 0;
        });
      }
      // Assign places based on the sorted scores.
      group.forEach((entry, idx) => {
        entry.place = idx + 1;
      });
      grouped[Number(totalPointsKey)] = group;
    }
  });

  // Rebuild the temporary table: sort first by totalPoints then by tie-break place.
  const finalTable = temporaryTable.slice().sort((a, b) => {
    if (a.totalPoints === b.totalPoints) {
      return (a.place ?? 0) - (b.place ?? 0);
    }
    return Number(a.totalPoints) - Number(b.totalPoints);
  });
  // Reassign global place ordering.
  finalTable.forEach((boat, index) => {
    boat.place = index + 1;
  });

  console.log(
    'Final Temporary Table with Places after tie-breaking:',
    finalTable,
  );
  return finalTable;
}
