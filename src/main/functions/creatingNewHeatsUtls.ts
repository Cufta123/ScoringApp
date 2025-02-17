/* eslint-disable camelcase */
import { db } from '../../../public/Database/DBManager';

export function assignBoatsToNewHeats(
  nextHeatNames: string[],
  raceNumber: number,
  event_id: number,
  latestHeats: { heat_name: string; heat_id: number }[],
) {
  console.log(`Race Number: ${raceNumber}`);

  console.log('Latest Heats:', latestHeats);

  const latestHeatIds = latestHeats.map((heat) => heat.heat_id);

  // Fetch old heats, their boats, and scores from the database
  const oldHeatsQuery = db.prepare(`
    SELECT h.heat_id, h.heat_name, b.boat_id, b.sail_number, s.name, s.surname, sc.points
    FROM Heats h
    JOIN Heat_Boat hb ON h.heat_id = hb.heat_id
    JOIN Boats b ON hb.boat_id = b.boat_id
    JOIN Sailors s ON b.sailor_id = s.sailor_id
    JOIN Scores sc ON sc.boat_id = b.boat_id AND sc.race_id IN (SELECT race_id FROM Races WHERE heat_id = h.heat_id)
    WHERE h.event_id = ? AND h.heat_type = 'Qualifying' AND h.heat_id IN (${latestHeatIds.join(',')})
  `);
  const oldHeats = oldHeatsQuery.all(event_id);

  // Create a dictionary to hold the boats grouped by their heat names
  const groupedByHeatName: Record<
    string,
    {
      boat_id: number;
      sail_number: number;
      name: string;
      surname: string;
      points: number;
    }[]
  > = {};

  // Populate the dictionary
  oldHeats.forEach(
    (heat: {
      heat_name: string | number;
      boat_id: any;
      sail_number: any;
      name: any;
      surname: any;
      points: any;
    }) => {
      if (!groupedByHeatName[heat.heat_name]) {
        groupedByHeatName[heat.heat_name] = [];
      }
      groupedByHeatName[heat.heat_name].push({
        boat_id: heat.boat_id,
        sail_number: heat.sail_number,
        name: heat.name,
        surname: heat.surname,
        points: heat.points,
      });
    },
  );

  // Sort the boats within each heat by their points
  Object.keys(groupedByHeatName).forEach((heatName) => {
    groupedByHeatName[heatName].sort((a, b) => a.points - b.points);
  });

  console.log('Grouped by Heat Name:', groupedByHeatName);

  // Create tables with just boat_id and points
  const tables = Object.keys(groupedByHeatName).map((heatName) => {
    return {
      heatName,
      boats: groupedByHeatName[heatName].map((boat) => ({
        boat_id: boat.boat_id,
        points: boat.points,
      })),
    };
  });

  // Log the tables with full details
  console.log('Tables:', JSON.stringify(tables, null, 2));

  // Number of new heats
  const numHeats = nextHeatNames.length;
  // According to the official rules, for old Heat A, finishing positions go A, B, C, D... in a cycle;
  // for old Heat B, finishing positions go B, C, D, A... in a cycle; etc.

  // 1) Sort old heat names in alphabetical order so that "Heat Axx" is index 0, "Heat Bxx" is index 1, etc.
  const sortedOldHeatNames = Object.keys(groupedByHeatName).sort((a, b) => {
    // A simple approach: parse out the single-letter label (A, B, C, D, etc.) after "Heat "
    // and compare them. (This works if your heat labels are single letters.)
    const matchA = a.match(/Heat ([A-Z]+)/);
    const matchB = b.match(/Heat ([A-Z]+)/);
    if (!matchA || !matchB) return a.localeCompare(b); // fallback
    return matchA[1].localeCompare(matchB[1]);
  });
  console.log(
    'Sorted old heat names in alphabetical order:',
    sortedOldHeatNames,
  );

  // We'll build a final array of assignments
  // each element is { heatId: number, boatId: number, boatName: string }
  const assignments: {
    heatId: number;
    boatId: number;
  }[] = [];

  // 2) For each old heat in alphabetical order, assign finishing positions to new heats
  sortedOldHeatNames.forEach((oldHeatName, oldHeatIndex) => {
    console.log(
      `\nProcessing old heat: "${oldHeatName}" (index ${oldHeatIndex})`,
    );

    const boats = groupedByHeatName[oldHeatName];

    boats.forEach((boat, positionIndex) => {
      // Finishing position is 1-based
      const finishingPos = positionIndex + 1;

      // Heat movement rule:
      // newHeatIndex = (oldHeatIndex + (finishingPos - 1)) mod numHeats
      const newHeatIndex =
        (((oldHeatIndex - (finishingPos - 1)) % numHeats) + numHeats) %
        numHeats;
      const boatName = `${boat.name} ${boat.surname}`;

      console.log(
        `\tBoat: "${boatName}" (boat_id: ${
          boat.boat_id
        }), finishing position: ${finishingPos}, → newHeatIndex: ${newHeatIndex}, newHeatName: "${
          nextHeatNames[newHeatIndex]
        }"`,
      );

      // Push the assignment
      assignments.push({
        heatId: newHeatIndex,
        boatId: boat.boat_id,
      });
    });
  });

  console.log('\nFinal assignments:', JSON.stringify(assignments, null, 2));
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
  database: any,
) {
  const raceCountQuery = database.prepare(
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
