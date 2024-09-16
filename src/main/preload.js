const { contextBridge } = require("electron")
const personDB = require("../../public/Database/PersonManager")

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
};

contextBridge.exposeInMainWorld('electron', electronHandler
