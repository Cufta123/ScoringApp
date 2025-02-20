/* eslint-disable camelcase */
/* eslint-disable camelcase */
interface LeaderboardEntry {
  boat_id: any;
  races: string[];
  heat_ids: { [key: string]: any };
}

export function HandleRaceChange({
  boatId,
  raceIndex,
  newHandleRaceChangeValue,
  editableLeaderboard,
  shiftPositions,
}: {
  boatId: any;
  raceIndex: number;
  newHandleRaceChangeValue: string;
  editableLeaderboard: LeaderboardEntry[];
  shiftPositions: boolean;
}) {
  console.log('--- HandleRaceChange called ---');
  console.log({ boatId, raceIndex, newHandleRaceChangeValue });

  if (
    !Number.isNaN(Number(newHandleRaceChangeValue)) &&
    Number(newHandleRaceChangeValue) >= 0
  ) {
    const updatedLeaderboard = editableLeaderboard.map((entry) => {
      if (entry.boat_id === boatId) {
        console.log(`>>> Updating entry for boat ${boatId}`);
        console.log('Current entry:', entry);
        const oldPosition = parseInt(entry.races[raceIndex], 10);
        const newPosition = parseInt(newHandleRaceChangeValue, 10);
        const heatId =
          entry.heat_ids && entry.heat_ids[raceIndex]
            ? entry.heat_ids[raceIndex]
            : null;

        // Log the leaderboard for the current heat BEFORE making any changes.
        const heatLeaderboardBefore = editableLeaderboard
          .filter((e) => e.heat_ids && e.heat_ids[raceIndex] === heatId)
          .map((e) => ({
            boat_id: e.boat_id,
            position: parseInt(e.races[raceIndex], 10),
          }))
          .sort((a, b) => a.position - b.position);
        console.log(
          `--- Heat ${heatId} (Race ${raceIndex + 1}) leaderboard BEFORE update:`,
          heatLeaderboardBefore,
        );

        // Update the position of the selected boat.
        entry.races[raceIndex] = newPosition.toString();
        console.log(
          `Boat ${boatId} position updated from ${oldPosition} to ${newPosition}`,
        );

        if (shiftPositions) {
          console.log('=== Starting shift process for other boats ===');
          console.log(
            `Shift mode: ${
              oldPosition > newPosition
                ? 'Shifting Others Down (boat moved up)'
                : 'Shifting Others Up (boat moved down)'
            }`,
          );
          const currentHeatId = heatId; // Use the same heat id for clarity.

          // Process and log shifts for each affected boat.
          editableLeaderboard.forEach((otherEntry) => {
            if (
              otherEntry.boat_id !== boatId &&
              otherEntry.races[raceIndex] !== undefined &&
              otherEntry.heat_ids &&
              otherEntry.heat_ids[raceIndex] === currentHeatId
            ) {
              const otherPosition = parseInt(otherEntry.races[raceIndex], 10);
              // Boat moved up: shift boats between newPosition and oldPosition up by +1.
              if (
                oldPosition > newPosition &&
                otherPosition >= newPosition &&
                otherPosition < oldPosition
              ) {
                console.log(
                  `>> Affected boat ${otherEntry.boat_id}: position ${otherPosition} will shift to ${
                    otherPosition + 1
                  } (moved up scenario)`,
                );
                otherEntry.races[raceIndex] = (otherPosition + 1).toString();
              }
              // Boat moved down: shift boats between oldPosition and newPosition down by -1.
              else if (
                oldPosition < newPosition &&
                otherPosition <= newPosition &&
                otherPosition > oldPosition
              ) {
                console.log(
                  `>> Affected boat ${otherEntry.boat_id}: position ${otherPosition} will shift to ${
                    otherPosition - 1
                  } (moved down scenario)`,
                );
                otherEntry.races[raceIndex] = otherPosition - 1;
              }
            }
          });
          console.log('=== Shift process completed ===');

          // Log the updated leaderboard for the heat AFTER shifting.
          const heatLeaderboardAfter = editableLeaderboard
            .filter(
              (e) => e.heat_ids && e.heat_ids[raceIndex] === currentHeatId,
            )
            .map((e) => ({
              boat_id: e.boat_id,
              position: parseInt(e.races[raceIndex], 10),
            }))
            .sort((a, b) => a.position - b.position);
          console.log(
            `--- Heat ${currentHeatId} (Race ${raceIndex + 1}) leaderboard AFTER update:`,
            heatLeaderboardAfter,
          );
        }

        const totalPointsEvent = entry.races.reduce(
          (acc: number, race: string) => acc + parseInt(race, 10),
          0,
        );
        const totalPointsFinal = totalPointsEvent;
        console.log('>>> New totals for boat', boatId, {
          totalPointsEvent,
          totalPointsFinal,
        });
        return {
          ...entry,
          total_points_event: totalPointsEvent,
          total_points_final: totalPointsFinal,
          heat_id: heatId, // Include heat_id in the entry.
        };
      }
      return entry;
    });

    // Recalculate total points for all boats after shifting positions.
    const recalculatedLeaderboard = updatedLeaderboard.map((entry) => {
      const totalPointsEvent = entry.races.reduce(
        (acc: number, race: string) => acc + parseInt(race, 10),
        0,
      );
      const totalPointsFinal = totalPointsEvent;
      return {
        ...entry,
        total_points_event: totalPointsEvent,
        total_points_final: totalPointsFinal,
      };
    });

    console.log('=== HandleRaceChange updated leaderboard ===');
    console.log(JSON.stringify(recalculatedLeaderboard, null, 2));
    return recalculatedLeaderboard;
  }
}

export async function HandleSave({
  eventId,
  leaderboard,
  editableLeaderboard,
  setLeaderboard,
  setEditableLeaderboard,
  setEditMode,
  shiftPositions,
  finalSeriesStarted,
}: {
  eventId: any;
  leaderboard: any;
  editableLeaderboard: LeaderboardEntry[];
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setEditableLeaderboard: (editableLeaderboard: LeaderboardEntry[]) => void;
  setEditMode: (editMode: boolean) => void;
  shiftPositions: boolean;
  finalSeriesStarted: boolean;
}) {
  console.log('HandleSave called', {
    eventId,
    shiftPositions,
    finalSeriesStarted,
  });
  console.log('Updated leaderboard before saving:', editableLeaderboard);
  try {
    if (!editableLeaderboard || !leaderboard) {
      throw new Error('Leaderboard data is not initialized');
    }

    // Get a mapping of race_id -> heat_id.
    // This IPC call must be implemented on the main side.
    // For example, it returns an object like: { "40": 1, "41": 1, "42": 1, ... }
    const raceToHeatMap: { [race_id: string]: any } =
      await window.electron.sqlite.heatRaceDB.getRaceMapping(eventId);

    // Build an array of update promises for changes found in races.
    const updatePromises: Promise<any>[] = [];
    editableLeaderboard.forEach(
      (entry: {
        boat_id?: any;
        races?: any;
        race_ids?: any;
        // heat_ids may not be present since readLeaderboard was not modified.
        heat_ids?: any;
      }) => {
        const originalEntry = leaderboard.find(
          (e: { boat_id: any }) => e.boat_id === entry.boat_id,
        );
        if (!originalEntry) return;

        for (let i = 0; i < entry.races.length; i += 1) {
          // Check for changes by comparing with the original entry.
          if (entry.races[i] !== originalEntry.races[i]) {
            const race_id = entry.race_ids[i]; // Get the correct race_id.
            // Determine heat_id: first try an existing heat_ids array then fall back to mapping.
            const heat_id =
              entry.heat_ids && entry.heat_ids[i]
                ? entry.heat_ids[i]
                : raceToHeatMap[race_id] || null;
            if (!race_id) {
              console.error('Race ID is missing for entry:', entry);
              return;
            }
            const newPosition = parseInt(entry.races[i], 10);
            console.log(
              `Updating race result for event_id: ${eventId}, race_id: ${race_id}, boat_id: ${entry.boat_id}, new_position: ${newPosition}, heat_id: ${heat_id}`,
            );
            // Call updateRaceResult – note that this only updates the score for the heat.
            updatePromises.push(
              window.electron.sqlite.heatRaceDB.updateRaceResult(
                eventId,
                race_id,
                entry.boat_id,
                newPosition.toString(),
                shiftPositions,
                heat_id,
              ),
            );
          }
        }
      },
    );

    console.log('Executing database update promises', updatePromises.length);
    // Wait for all update operations to complete.
    await Promise.all(updatePromises);

    // Now, update the event leaderboard (total points are recalculated based on current Scores)
    await window.electron.sqlite.heatRaceDB.updateEventLeaderboard(eventId);
    console.log('Event leaderboard updated in database');

    // Refresh the leaderboard with updated data.
    const results = finalSeriesStarted
      ? await window.electron.sqlite.heatRaceDB.readFinalLeaderboard(eventId)
      : await window.electron.sqlite.heatRaceDB.readLeaderboard(eventId);

    // Process results as before (without heat_ids modification)
    const leaderboardWithRaces = results.map(
      (entry: { race_positions: string; race_ids: string }) => ({
        ...entry,
        races: entry.race_positions ? entry.race_positions.split(',') : [],
        race_ids: entry.race_ids ? entry.race_ids.split(',') : [],
      }),
    );

    leaderboardWithRaces.sort(
      (
        a: { total_points_final: number; total_points_event: number },
        b: { total_points_final: number; total_points_event: number },
      ) =>
        finalSeriesStarted
          ? a.total_points_final - b.total_points_final
          : a.total_points_event - b.total_points_event,
    );

    console.log('Leaderboard refreshed', leaderboardWithRaces);
    setLeaderboard(leaderboardWithRaces);
    setEditableLeaderboard(JSON.parse(JSON.stringify(leaderboardWithRaces))); // Clone for editing.
    setEditMode(false); // Exit edit mode after saving.
    console.log('HandleSave completed successfully');
  } catch (error: any) {
    console.error('Error saving leaderboard:', error.message);
  }
}
