// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example' | 'readAllPerson' | 'insertPerson' | 'readAllSailors' | 'insertSailor' | 'readAllCategories' | 'readAllClubs'
  | 'insertClub' | 'insertBoat' | 'readAllBoats';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args)
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  sqlite: {
    personDB: {
      async readAllPerson() {
        try {
          return await ipcRenderer.invoke('readAllPerson');
        } catch (error) {
          console.error('Error invoking readAllPerson IPC:', error);
        }
      },
      async insertPerson(name: string, surname: string, birthday: string, category: string, club: string, sail_number: string, model: string) {
        try {
          return await ipcRenderer.invoke('insertPerson', name, surname, birthday, category, club, sail_number, model);
        } catch (error) {
          console.error('Error invoking insertPerson IPC:', error);
        }
      }
    },
    sailorDB: {
      async readAllSailors() {
        try {
          return await ipcRenderer.invoke('readAllSailors');
        } catch (error) {
          console.error('Error invoking readAllSailors IPC:', error);
        }
      },
      async insertSailor(name: string, surname: string, category_id: string, club_id: string, boat_id: string) {
        try {
          return await ipcRenderer.invoke('insertSailor', name, surname, category_id, club_id, boat_id);
        } catch (error) {
          console.error('Error invoking insertSailor IPC:', error);
        }
      },
      async insertClub(club_name: string, country: string) {
        try {
          return await ipcRenderer.invoke('insertClub', club_name, country);
        } catch (error) {
          console.error('Error invoking insertClub IPC:', error);
        }
      },
      async insertBoat(sail_number: string, country: string, model: string) {
        try {
          return await ipcRenderer.invoke('insertBoat', sail_number, country, model);
        } catch (error) {
          console.error('Error invoking insertBoat IPC:', error);
        }
      },
      async readAllCategories() {
        try {
          return await ipcRenderer.invoke('readAllCategories');
        } catch (error) {
          console.error('Error invoking readAllCategories IPC:', error);
        }
      },
      async readAllClubs() {
        try {
          return await ipcRenderer.invoke('readAllClubs');
        } catch (error) {
          console.error('Error invoking readAllClubs IPC:', error);
        }
      },
      async readAllBoats() {
        try {
          return await ipcRenderer.invoke('readAllBoats');
        } catch (error) {
          console.error('Error invoking readAllBoats IPC:', error);
        }
      }
    }
  }
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
