export default function LatestHeats(heats: any[]): any[] {
  // Updated regex: make the race number optional using (?:\s+(\d+))?
  const pattern = /^(?:(\d+)\s+)?(?:Q|F)Race(?:\s+(\d+))?,\s+Heat\s+([A-Z])/;

  // Filter out heats that match the pattern
  const validHeats = heats.filter((heat) => pattern.test(heat.heat_name));

  // Determine the maximum race number (captured from group 2), or default to 0 if undefined.
  const latestRaceNumber = Math.max(
    ...validHeats.map((heat) => {
      const match = heat.heat_name.match(pattern);
      return match && match[2] ? parseInt(match[2], 10) : 0;
    }),
  );

  // Return only heats that belong to the latest race number; if none have a race number, return all.
  return validHeats.filter((heat) => {
    const match = heat.heat_name.match(pattern);
    // If no race number, include the heat.
    if (!match || !match[2]) {
      return true;
    }
    return parseInt(match[2], 10) === latestRaceNumber;
  });
}
