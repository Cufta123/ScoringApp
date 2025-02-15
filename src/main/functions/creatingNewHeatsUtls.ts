export function assignBoatsToNewHeats(
  leaderboardResults: { boat_id: number }[],
  nextHeatNames: string[],
  raceNumber: number,
) {
  // The number of new heats
  const numHeats = nextHeatNames.length;

  // This array will hold the final assignments:
  // each element is { heatId: number, boatId: number }
  const assignments = [];

  // Distribute each boat to a new heat using the modulo pattern.
  // We assume `leaderboardResults` is sorted by finishing position,
  // so index i => finishing position i+1 in the previous race.
  for (let i = 0; i < leaderboardResults.length; i += 1) {
    const boatId = leaderboardResults[i].boat_id;
    // Use modulo to decide which new heat this boat goes to
    const newHeatIndex = i % numHeats;
    assignments.push({ heatId: newHeatIndex, boatId });
  }

  return assignments;
}

export function findLatestHeatsBySuffix(
  existingHeats: { heat_name: string; heat_id: number }[],
) {
  const latestHeats = existingHeats.reduce(
    (
      acc: Record<
        string,
        { suffix: number; heat: { heat_name: string; heat_id: number } }
      >,
      heat: { heat_name: string; heat_id: number },
    ) => {
      const match = heat.heat_name.match(/Heat ([A-Z]+)(\d*)/);
      if (match) {
        const [_, base, suffix] = match;
        const numericSuffix = suffix ? parseInt(suffix, 10) : 0;
        acc[base] = acc[base] || { suffix: 0, heat: null };
        if (numericSuffix > acc[base].suffix) {
          acc[base] = { suffix: numericSuffix, heat };
        }
      }
      return acc;
    },
    {},
  );

  return Object.values(latestHeats)
    .map(
      (entry) =>
        (
          entry as {
            suffix: number;
            heat: { heat_name: string; heat_id: number };
          }
        ).heat,
    )
    .filter((heat) => heat !== null); // Filter out null values
}

export function checkRaceCountForLatestHeats(
  lastHeats: { heat_name: string; heat_id: number }[],
  db: any,
) {
  const raceCountQuery = db.prepare(
    `SELECT COUNT(*) as race_count FROM Races WHERE heat_id = ?`,
  );

  const heatRaceCounts = lastHeats.map((heat) => {
    const raceCount = raceCountQuery.get(heat.heat_id).race_count;
    return { heat_name: heat.heat_name, raceCount };
  });

  const uniqueRaceCounts = [
    ...new Set(heatRaceCounts.map((item) => item.raceCount)),
  ];

  if (uniqueRaceCounts.length > 1) {
    throw new Error('Latest heats do not have the same number of races.');
  }
}

export function generateNextHeatNames(
  latestHeats: { heat_name: string; heat_id: number }[],
) {
  const heatMap = latestHeats.reduce(
    (
      acc: Record<
        string,
        { suffix: number; heat: { heat_name: string; heat_id: number } }
      >,
      heat: { heat_name: string; heat_id: number },
    ) => {
      const match = heat.heat_name.match(/Heat ([A-Z]+)(\d*)/);
      if (match) {
        const [_, base, suffix] = match;
        const numericSuffix = suffix ? parseInt(suffix, 10) : 0;
        acc[base] = acc[base] || { suffix: 0, heat: null };
        if (numericSuffix > acc[base].suffix) {
          acc[base] = { suffix: numericSuffix, heat };
        }
      }
      return acc;
    },
    {},
  );

  return Object.keys(heatMap).map(
    (base) => `Heat ${base}${heatMap[base].suffix + 1}`,
  );
}
