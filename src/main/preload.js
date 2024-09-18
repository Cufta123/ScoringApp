const { contextBridge, ipcRenderer } = require('electron');
const personDB = require('../../public/Database/PersonManager');
const sailorDB = require('../../public/Database/SailorsManager');

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
  personDB: {
    readAllPerson: personDB.readAllPerson,
    insertPerson: personDB.insertPerson,
    getAllClubs: personDB.getAllClubs,
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
};

contextBridge.exposeInMainWorld('electron', electronHandler);
