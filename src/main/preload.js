const { contextBridge, ipcRenderer } = require('electron');
const sailorDB = require('../../public/Database/SailorsManager');
const eventDB = require('../../public/Database/EventManager');

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel, ...args) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel, func) {
      const subscription = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel, func) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  sailorDB: {
    readAllSailors: sailorDB.readAllSailors,
    insertSailor: sailorDB.insertSailor,
    insertClub: sailorDB.insertClub,
    insertBoat: sailorDB.insertBoat,
    readAllCategories: sailorDB.readAllCategories,
    readAllClubs: sailorDB.readAllClubs,
    readAllBoats: sailorDB.readAllBoats,
  },
  eventDB: {
    readAllEvents: eventDB.readAllEvents,
    insertEvent: eventDB.insertEvent,
    associateBoatWithEvent: eventDB.associateBoatWithEvent,
    readBoatsByEvent: eventDB.readBoatsByEvent,
    removeBoatFromEvent: eventDB.removeBoatFromEvent,
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);
