const heatService = {
  readAllHeats: (eventId) =>
    window.electron.sqlite.heatRaceDB.readAllHeats(eventId),
  deleteLastRaceForHeat: (heatId) =>
    window.electron.sqlite.heatRaceDB.deleteLastRaceForHeat(heatId),
  deleteHeat: (heatId) =>
    window.electron.sqlite.heatRaceDB.deleteHeatById(heatId),
  deleteLastHeats: (eventId) =>
    window.electron.sqlite.heatRaceDB.deleteLastCreatedHeatsWithRaces(eventId),
  readAllRaces: (heatId) =>
    window.electron.sqlite.heatRaceDB.readAllRaces(heatId),
  readBoatsByHeat: (heatId) =>
    window.electron.sqlite.heatRaceDB.readBoatsByHeat(heatId),
  insertRace: (heatId, nextRaceNumber) =>
    window.electron.sqlite.heatRaceDB.insertRace(heatId, nextRaceNumber),
  insertScore: (raceId, boatId, place, displayPlace, status) =>
    window.electron.sqlite.heatRaceDB.insertScore(
      raceId,
      boatId,
      place,
      displayPlace,
      status,
    ),
  updateEventLeaderboard: (eventId, flag) =>
    window.electron.sqlite.heatRaceDB.updateEventLeaderboard(eventId, flag),
  updateFinalLeaderboard: (eventId) =>
    window.electron.sqlite.heatRaceDB.updateFinalLeaderboard(eventId),
  createNewHeatsBasedOnLeaderboard: (eventId) =>
    window.electron.sqlite.heatRaceDB.createNewHeatsBasedOnLeaderboard(eventId),
};

export default heatService;
