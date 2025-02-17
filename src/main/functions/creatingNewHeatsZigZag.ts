export default function assignBoatsToNewHeatsZigZag(
  tableOfParticipants: string | any[],
  heats: string | any[], // Array of heat objects from the database (each with a 'heat_id' property)
) {
  const numHeats = heats.length;
  const numBoats = tableOfParticipants.length;
  const baseParticipantsPerHeat = Math.floor(numBoats / numHeats);
  const extraParticipants = numBoats % numHeats;
  const participantsPerHeat = new Array(numHeats).fill(baseParticipantsPerHeat);

  // Distribute extra participants among the first few heats
  for (let i = 0; i < extraParticipants; i += 1) {
    participantsPerHeat[i] += 1;
  }

  const assignments = [];
  let direction = 1;
  let heatIndex = 0;
  let repeatedBoundary = false;
  const remainingSpots = [...participantsPerHeat];

  const findAvailableHeat = () => {
    for (let j = 0; j < numHeats; j += 1) {
      if (remainingSpots[j] > 0) {
        return j;
      }
    }
    return heatIndex;
  };

  for (let i = 0; i < tableOfParticipants.length; i += 1) {
    const boatId = tableOfParticipants[i].boat_id;
    // Use the actual heat_id from the heats array instead of the index
    assignments.push({ heatId: heats[heatIndex].heat_id, boatId });
    remainingSpots[heatIndex] -= 1;

    if (i === tableOfParticipants.length - 1) break;

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

  return assignments;
}
