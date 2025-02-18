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
  const boatScoresByPoints = new Map<string, number[]>();
  const boatScoresByRace = new Map<string, number[]>();

  // Initialize maps for all boats from summaryResults.
  summaryResults.forEach((result) => {
    boatScoresByPoints.set(result.boat_id, []);
    boatScoresByRace.set(result.boat_id, []);
  });
  console.log('After initialization:');
  console.log('boatScoresByPoints:', Array.from(boatScoresByPoints.entries()));
  console.log('boatScoresByRace:', Array.from(boatScoresByRace.entries()));

  // Populate the maps using the rawScores.
  rawScores.forEach((score) => {
    if (boatScoresByPoints.has(score.boat_id)) {
      // For points-based ordering, we want scores sorted descending.
      boatScoresByPoints.get(score.boat_id)!.push(score.points);
      // For race-based (tie-break) ordering, assume rawScores came in order of race_number descending.
      boatScoresByRace.get(score.boat_id)!.push(score.points);
    }
  });
  console.log('After populating rawScores:');
  console.log('boatScoresByPoints:', Array.from(boatScoresByPoints.entries()));
  console.log('boatScoresByRace:', Array.from(boatScoresByRace.entries()));

  // Optionally sort each boat's scores if not already in proper order.
  boatScoresByPoints.forEach((scores, boat_id) => {
    // sort descending: highest points first
    scores.sort((a, b) => b - a);
    boatScoresByPoints.set(boat_id, scores);
  });
  console.log('After sorting boatScoresByPoints:');
  console.log('boatScoresByPoints:', Array.from(boatScoresByPoints.entries()));

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
    // If final series ranking is requested, exclude one additional (i.e. the second worst) race score.
    if (finalSeries) {
      excludeCount += 1;
    }
    // Exclude the "worst" scores – we assume that the beginning of the sorted array (highest points) should be excluded.
    const scoresToInclude = scores.slice(excludeCount);
    const totalPoints = scoresToInclude.reduce((acc, score) => acc + score, 0);
    console.log(
      `Boat ${boat_id}: number_of_races = ${number_of_races}, excludeCount = ${excludeCount}`,
    );
    console.log(
      `Boat ${boat_id}: scores =`,
      scores,
      '-> scoresToInclude =',
      scoresToInclude,
      'totalPoints =',
      totalPoints,
    );
    temporaryTable.push({ boat_id, totalPoints });
  });

  console.log('Temporary table before sorting:', temporaryTable);

  // Sort by total points ascending (i.e. lower totalPoints is better).
  temporaryTable.sort((a, b) => a.totalPoints - b.totalPoints);
  // Assign initial places.
  temporaryTable.forEach((boat, index) => {
    boat.place = index + 1;
  });
  console.log(
    'Temporary table after initial place assignment:',
    temporaryTable,
  );

  // --- Tie-breaking ---
  // Group boats with the same total points.
  const grouped: Record<number, TemporaryTableEntry[]> = {};
  temporaryTable.forEach((entry) => {
    if (!grouped[entry.totalPoints]) grouped[entry.totalPoints] = [];
    grouped[entry.totalPoints].push(entry);
  });
  console.log('Grouped boats with equal totalPoints:', grouped);

  // For any group with more than one boat, apply tie-breaking logic.
  Object.keys(grouped).forEach((totalPointsKey) => {
    const group = grouped[Number(totalPointsKey)];
    if (group.length > 1) {
      // For tie-breaking, compare the scores from boatScoresByRace (assumed ordered by race_number descending)
      group.sort((a, b) => {
        const scoresA = boatScoresByRace.get(a.boat_id) || [];
        const scoresB = boatScoresByRace.get(b.boat_id) || [];
        const maxLength = Math.max(scoresA.length, scoresB.length);
        // Compare from the last race backward.
        for (let i = 1; i <= maxLength; i++) {
          const scoreA = scoresA[scoresA.length - i] ?? Number.MAX_SAFE_INTEGER;
          const scoreB = scoresB[scoresB.length - i] ?? Number.MAX_SAFE_INTEGER;
          if (scoreA !== scoreB) return scoreA - scoreB;
        }
        return 0;
      });
      console.log(
        `Tie-breaking group for totalPoints ${totalPointsKey}:`,
        group,
      );
      // Update the places for the boats in this group.
      group.forEach((entry, idx) => (entry.place = idx + 1));
      grouped[Number(totalPointsKey)] = group;
    }
  });

  // Rebuild the temporary table: sort first by totalPoints then by tie-break place.
  const finalTable = temporaryTable.slice().sort((a, b) => {
    if (a.totalPoints === b.totalPoints) {
      return (a.place ?? 0) - (b.place ?? 0);
    }
    return a.totalPoints - b.totalPoints;
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
