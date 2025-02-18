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
    const qualifyingHeats = allHeats.filter(
      (heat: { heat_type: string }) => heat.heat_type === 'Qualifying',
    );
    const numFinalHeats = new Set(
      qualifyingHeats.map(
        (heat: { heat_name: { match: (arg0: RegExp) => any[] } }) =>
          heat.heat_name.match(/Heat ([A-Z])/)[1],
      ),
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
      // Call calculateBoatScores with finalSeriesRanking flag enabled
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
    } else {
      finalRanking = leaderboard;
      console.log('No need to update leaderboard:', finalRanking);
    }

    // Determine fleet sizes using the ranking order in finalRanking
    const boatsPerFleet = Math.floor(finalRanking.length / numFinalHeats);
    const extraBoats = finalRanking.length % numFinalHeats;
    const fleetNames = ['Gold', 'Silver', 'Bronze', 'Copper', 'Iron'];

    // Build data for each final heat (fleet)
    let boatIndex = 0;
    const heatsData: {
      heatName: string;
      heatType: string;
      boatsToAssign: string[];
    }[] = [];

    for (let i = 0; i < numFinalHeats; i += 1) {
      const fleetName = fleetNames[i] || `Fleet ${i + 1}`;
      const heatName = `Heat ${fleetName}`;
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

    setFinalSeriesStarted(true); // Final series is now started
    alert('Final Series started successfully!');
    handleDisplayHeats(); // Refresh the heats display
  } catch (error) {
    console.error('Error starting final series:', error);
    alert('Error starting final series. Please try again later.');
  }
}
