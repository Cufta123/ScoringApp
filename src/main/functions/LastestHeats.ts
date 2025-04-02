export default function LatestHeats(heats: any[]): any[] {
  // Use a regex to capture the race number and heat letter,
  // for example: "QRace 3, Heat A"
  const pattern = /QRace\s+(\d+),\s+Heat\s+([A-Z])/;

  // Filter out heats that match the pattern
  const validHeats = heats.filter((heat) => pattern.test(heat.heat_name));

  // Determine the maximum race number
  const latestRaceNumber = Math.max(
    ...validHeats.map((heat) => {
      const match = heat.heat_name.match(pattern);
      return match ? parseInt(match[1], 10) : 0;
    }),
  );

  // Return only heats that belong to the latest race number
  return validHeats.filter((heat) => {
    const match = heat.heat_name.match(pattern);
    return match && parseInt(match[1], 10) === latestRaceNumber;
  });
}
