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
  race_id: number; // Updated: using race_id instead of race_number
  heat_name: string;
  heat_id: number;
  status: string;
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
  // - boatScoresByRace: sorted descending by race_id (for tie-breaking)
  const boatScoresByPoints = new Map<
    string,
    { points: number; heat_name: string; heat_id: number; status: string }[]
  >();
  const boatScoresByRace = new Map<
    string,
    {
      points: number;
      heat_name: string;
      heat_id: number;
      status: string;
      race_id: number;
    }[]
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
      // For race-based (tie-break) ordering, use race_id instead of race_number.
      boatScoresByRace.get(score.boat_id)!.push({
        race_id: score.race_id, // Changed property name from race_number to race_id
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

  // Create a map to store the scores actually included in the totalPoints calculation.
  const boatIncludedScores = new Map<
    string,
    { points: number; heat_name: string; heat_id: number; status: string }[]
  >();

  // Calculate each boat's total points after exclusion.
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
    // For tie-breaking, sort included scores in best-to-worst order (i.e. ascending)
    const sortedIncludedScores = scoresToInclude
      .slice()
      .sort((a, b) => Number(a.points) - Number(b.points));
    boatIncludedScores.set(boat_id, sortedIncludedScores);

    const totalPoints = sortedIncludedScores.reduce(
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
      console.log(
        '[DEBUG] Processing tie-break for boats:',
        group.map((entry) => entry.boat_id),
      );

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

      // Calculate heats where all tied boats competed
      const heatsWithAllTiedBoats = commonHeats.filter((heatId) =>
        tiedBoats.every((boat_id) =>
          racesTogether[Number(heatId)].includes(boat_id),
        ),
      );

      console.log('[DEBUG] Heats with all tied boats:', heatsWithAllTiedBoats);

      if (heatsWithAllTiedBoats.length > 0) {
        console.log(
          '[DEBUG] Common heats found for tied boats:',
          heatsWithAllTiedBoats,
        );

        // Tie-break sorting using common heats.
        group.sort((boatA, boatB) => {
          const scoresA = heatsWithAllTiedBoats
            .flatMap((heatId) =>
              (boatScoresByRace.get(boatA.boat_id) || [])
                .filter((score) => score.heat_id === Number(heatId))
                .map((score) => Number(score.points)),
            )
            .sort((a, b) => a - b);
          const scoresB = heatsWithAllTiedBoats
            .flatMap((heatId) =>
              (boatScoresByRace.get(boatB.boat_id) || [])
                .filter((score) => score.heat_id === Number(heatId))
                .map((score) => Number(score.points)),
            )
            .sort((a, b) => a - b);

          for (
            let k = 0;
            k < Math.max(scoresA.length, scoresB.length);
            k += 1
          ) {
            const ptA = scoresA[k] ?? Number.MAX_SAFE_INTEGER;
            const ptB = scoresB[k] ?? Number.MAX_SAFE_INTEGER;
            if (ptA !== ptB) {
              return ptA - ptB;
            }
          }
          // Fallback if still tied: compare raw race scores descending (last race first)
          const fullRawArrayA = (boatScoresByRace.get(boatA.boat_id) || [])
            .filter((score) =>
              heatsWithAllTiedBoats.includes(String(score.heat_id)),
            )
            .slice()
            .sort((s1, s2) => s1.race_id - s2.race_id);
          const fullRawArrayB = (boatScoresByRace.get(boatB.boat_id) || [])
            .filter((score) =>
              heatsWithAllTiedBoats.includes(String(score.heat_id)),
            )
            .slice()
            .sort((s1, s2) => s1.race_id - s2.race_id);

          const rawScoresA = fullRawArrayA
            .slice()
            .sort((s1, s2) => s2.race_id - s1.race_id)
            .map((s) => Number(s.points));
          const rawScoresB = fullRawArrayB
            .slice()
            .sort((s1, s2) => s2.race_id - s1.race_id)
            .map((s) => Number(s.points));

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
        console.log('Tie-break sorting result for group:', group);
      } else {
        console.log(
          'No common heats found. Applying default tie-breaking logic for the following boats:',
          group.map((entry) => entry.boat_id),
        );

        group.forEach((boat) => {
          const scores = boatIncludedScores.get(boat.boat_id) || [];
          console.log(
            `Scores for boat ${boat.boat_id} (sorted):`,
            scores.map((score) => Number(score.points)),
          );
        });

        group.sort((a, b) => {
          console.log(`Comparing boat ${a.boat_id} with boat ${b.boat_id}`);
          const scoresA = (boatIncludedScores.get(a.boat_id) || [])
            .map((score) => Number(score.points))
            .sort((x, y) => x - y);
          const scoresB = (boatIncludedScores.get(b.boat_id) || [])
            .map((score) => Number(score.points))
            .sort((x, y) => x - y);
          console.log(`Scores for boat ${a.boat_id} (sorted):`, scoresA);
          console.log(`Scores for boat ${b.boat_id} (sorted):`, scoresB);
          for (
            let i = 0;
            i < Math.max(scoresA.length, scoresB.length);
            i += 1
          ) {
            const scoreA = scoresA[i] ?? Number.MAX_SAFE_INTEGER;
            const scoreB = scoresB[i] ?? Number.MAX_SAFE_INTEGER;
            if (scoreA !== scoreB) {
              console.log(
                `Tie broken between boat ${a.boat_id} and boat ${b.boat_id}: Boat ${scoreA < scoreB ? a.boat_id : b.boat_id} wins by included scores comparison`,
              );
              return scoreA - scoreB;
            }
          }
          console.log(
            `No difference found between boat ${a.boat_id} and boat ${b.boat_id} in included scores. Falling back to raw race scores.`,
          );

          const fullRawArrayA = (boatScoresByRace.get(a.boat_id) || [])
            .slice()
            .sort((s1, s2) => s1.race_id - s2.race_id);
          const fullRawArrayB = (boatScoresByRace.get(b.boat_id) || [])
            .slice()
            .sort((s1, s2) => s1.race_id - s2.race_id);
          console.log(
            `Boat ${a.boat_id} full raw race details (chronological order by race_id):`,
            fullRawArrayA,
          );
          console.log(
            `Boat ${b.boat_id} full raw race details (chronological order by race_id):`,
            fullRawArrayB,
          );
          console.log(
            `Boat ${a.boat_id} raw race scores in chronological order (first to last):`,
            fullRawArrayA.map((s) => Number(s.points)),
          );
          console.log(
            `Boat ${b.boat_id} raw race scores in chronological order (first to last):`,
            fullRawArrayB.map((s) => Number(s.points)),
          );

          const rawScoresA = fullRawArrayA
            .slice()
            .sort((s1, s2) => s2.race_id - s1.race_id)
            .map((s) => Number(s.points));
          const rawScoresB = fullRawArrayB
            .slice()
            .sort((s1, s2) => s2.race_id - s1.race_id)
            .map((s) => Number(s.points));
          console.log(
            `Boat ${a.boat_id} raw race scores sorted descending (last race first):`,
            rawScoresA,
          );
          console.log(
            `Boat ${b.boat_id} raw race scores sorted descending (last race first):`,
            rawScoresB,
          );

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
                `Tie broken between boat ${a.boat_id} and boat ${b.boat_id} using raw race scores (last race first): Boat ${ptA < ptB ? a.boat_id : b.boat_id} wins this comparison`,
              );
              return ptA - ptB;
            }
          }
          return 0;
        });
      }

      // Update group places accordingly
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
