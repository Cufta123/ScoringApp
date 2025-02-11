export function assignBoatsToNewHeatsZigZag(
  leaderboardResults: string | any[],
  nextHeatNames: string | any[],
  raceNumber: number,
) {
  const numHeats = nextHeatNames.length;
  const numBoats = leaderboardResults.length;
  const baseParticipantsPerHeat = Math.floor(numBoats / numHeats);
  const extraParticipants = numBoats % numHeats;
  const participantsPerHeat = new Array(numHeats).fill(baseParticipantsPerHeat);

  for (let i = 0; i < extraParticipants; i += 1) {
    participantsPerHeat[i] += 1;
  }

  const assignments = [];

  if (raceNumber === 1) {
    let heatIndex = 0;
    for (let i = 0; i < leaderboardResults.length; i += 1) {
      const boatId = leaderboardResults[i].boat_id;
      assignments.push({ heatId: heatIndex, boatId });
      heatIndex = (heatIndex + 1) % numHeats;
    }
  } else {
    let direction = 1;
    let heatIndex = 0;
    let repeatedBoundary = false;
    const remainingSpots = [...participantsPerHeat];

    const findAvailableHeat = () => {
      for (let j = 0; j < numHeats; j++) {
        if (remainingSpots[j] > 0) {
          return j;
        }
      }
      return heatIndex;
    };

    for (let i = 0; i < leaderboardResults.length; i += 1) {
      const boatId = leaderboardResults[i].boat_id;
      assignments.push({ heatId: heatIndex, boatId });
      remainingSpots[heatIndex] -= 1;

      if (i === leaderboardResults.length - 1) break;

      let candidate;

      if (heatIndex === numHeats - 1 && direction === 1) {
        if (!repeatedBoundary && remainingSpots[heatIndex] > 0) {
          candidate = heatIndex;
          repeatedBoundary = true;
        } else {
          repeatedBoundary = false;
          direction = -1;
          candidate = heatIndex + direction;
        }
      } else if (heatIndex === 0 && direction === -1) {
        if (!repeatedBoundary && remainingSpots[heatIndex] > 0) {
          candidate = heatIndex;
          repeatedBoundary = true;
        } else {
          repeatedBoundary = false;
          direction = 1;
          candidate = heatIndex + direction;
        }
      } else {
        candidate = heatIndex + direction;
      }

      if (
        candidate < 0 ||
        candidate >= numHeats ||
        remainingSpots[candidate] === 0
      ) {
        direction = -direction;
        candidate = heatIndex + direction;
        if (
          candidate < 0 ||
          candidate >= numHeats ||
          remainingSpots[candidate] === 0
        ) {
          candidate = findAvailableHeat();
        }
        repeatedBoundary = false;
      }

      heatIndex = candidate;
    }
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
