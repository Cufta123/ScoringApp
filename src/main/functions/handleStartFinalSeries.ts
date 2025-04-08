/* eslint-disable no-alert */
/* eslint-disable no-console */
/* eslint-disable camelcase */

import calculateBoatScores from './calculateBoatScores';

interface HandleStartFinalSeriesParams {
  event: { event_id: string };
  setFinalSeriesStarted: (started: boolean) => void;
  handleDisplayHeats: () => void;
}

export default async function handleStartFinalSeries({
  event,
  setFinalSeriesStarted,
  handleDisplayHeats,
}: HandleStartFinalSeriesParams) {
  try {
    const allHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(
      event.event_id,
    );

    const summaryResults =
      await window.electron.sqlite.heatRaceDB.getSummaryResults(event.event_id);
    const rawScores = await window.electron.sqlite.heatRaceDB.getScoresResult(
      event.event_id,
    );
    // Filter qualifying heats by checking for the new naming convention "QRace"
    const qualifyingHeats = allHeats.filter((heat: { heat_name: string }) =>
      heat.heat_name.startsWith('QRace'),
    );
    // Extract the letter from "QRace [number], Heat [Letter]" and count unique letters
    const numFinalHeats = new Set(
      qualifyingHeats.map((heat: { heat_name: string }) => {
        const match = heat.heat_name.match(/QRace\s*\d+,\s*Heat\s+([A-Z])/);
        if (!match) {
          throw new Error(`Heat name format unexpected: ${heat.heat_name}`);
        }
        return match[1];
      }),
    ).size;

    // Fetch leaderboard and determine number of completed races
    const leaderboard = await window.electron.sqlite.heatRaceDB.readLeaderboard(
      event.event_id,
    );
    console.log('Leaderboard:', leaderboard);
    // Calculate the maximum number of races from summaryResults
    const numCompletedRaces = summaryResults.reduce(
      (max: number, result: { number_of_races: number }) =>
        Math.max(max, result.number_of_races),
      0,
    );
    console.log(
      'Number of completed races (from summaryResults):',
      numCompletedRaces,
    );
    console.log('Number of completed races', numCompletedRaces);
    let finalRanking;
    if (numCompletedRaces > 5 && numCompletedRaces < 8) {
      const setMoreThan5LestThan8 = true;
      finalRanking = calculateBoatScores(
        summaryResults,
        rawScores,
        setMoreThan5LestThan8,
      );
      console.log(
        'Updated leaderboard with second worst race excluded:',
        finalRanking,
      );
      // Fallback if calculateBoatScores returned undefined
      if (!finalRanking) {
        console.warn(
          'calculateBoatScores returned undefined; falling back to leaderboard.',
        );
        finalRanking = leaderboard;
      }
    } else {
      finalRanking = leaderboard;
      console.log('No need to update leaderboard:', finalRanking);
    }

    // Determine fleet sizes using the ranking order in finalRanking
    const boatsPerFleet = Math.floor(finalRanking.length / numFinalHeats);
    const extraBoats = finalRanking.length % numFinalHeats;

    // Build data for each final heat using the new naming convention
    let boatIndex = 0;
    const heatsData: {
      heatName: string;
      heatType: string;
      boatsToAssign: string[];
    }[] = [];

    for (let i = 0; i < numFinalHeats; i += 1) {
      const heatLetter = String.fromCharCode(65 + i); // A, B, C, etc.
      const heatName = `FRace, Heat ${heatLetter}`;
      const heatType = 'Final';
      const boatsInThisFleet = boatsPerFleet + (i < extraBoats ? 1 : 0);

      // Slice out the boats for this heat based on the updated ranking
      const boatsToAssign = finalRanking
        .slice(boatIndex, boatIndex + boatsInThisFleet)
        .map((boat: { boat_id: any }) => boat.boat_id);
      boatIndex += boatsInThisFleet;

      heatsData.push({ heatName, heatType, boatsToAssign });
    }

    // Insert all heats concurrently
    const heatInsertPromises = heatsData.map((heatInfo) =>
      window.electron.sqlite.heatRaceDB.insertHeat(
        event.event_id,
        heatInfo.heatName,
        heatInfo.heatType,
      ),
    );
    const heatInsertResults = await Promise.all(heatInsertPromises);

    // Prepare promises for inserting boats into their respective heats
    const fleetBoatPromises: Promise<any>[] = [];
    for (let i = 0; i < heatsData.length; i += 1) {
      const newHeatId = heatInsertResults[i].lastInsertRowid;
      heatsData[i].boatsToAssign.forEach((boat_id) => {
        fleetBoatPromises.push(
          window.electron.sqlite.heatRaceDB.insertHeatBoat(newHeatId, boat_id),
        );
      });
    }
    await Promise.all(fleetBoatPromises);

    console.log('Setting final series started to');
    setFinalSeriesStarted(true); // Final series is now started
    handleDisplayHeats(); // Refresh the heats display
  } catch (error: unknown) {
    console.error(
      'Error starting final series for event:',
      event.event_id,
      error,
    );
    let detailedError = `An error occurred while starting the final series for event ${event.event_id}.\n`;
    if (error instanceof Error) {
      detailedError += `Error message: ${error.message}\n`;
      if (error.stack) {
        detailedError += `Stack trace: ${error.stack}\n`;
      }
    } else {
      detailedError += `Error details: ${String(error)}\n`;
    }
    alert(detailedError);
  }
}
