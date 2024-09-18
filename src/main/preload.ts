/* eslint-disable no-console */
/* eslint-disable camelcase */
// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'readAllPerson'
  | 'insertPerson'
  | 'readAllSailors'
  | 'insertSailor'
  | 'readAllCategories'
  | 'readAllClubs'
  | 'insertClub'
  | 'insertBoat'
  | 'readAllBoats';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
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
          return false;
        }
      },
      async insertPerson(
        name: string,
        surname: string,
        birthday: string,
        category: string,
        club: string,
        sail_number: string,
        model: string,
      ) {
        try {
          return await ipcRenderer.invoke(
            'insertPerson',
            name,
            surname,
            birthday,
            category,
            club,
            sail_number,
            model,
          );
        } catch (error) {
          console.error('Error invoking insertPerson IPC:', error);
          return false;
        }
      },
    },
    sailorDB: {
      async readAllSailors() {
        try {
          return await ipcRenderer.invoke('readAllSailors');
        } catch (error) {
          console.error('Error invoking readAllSailors IPC:', error);
          return false;
        }
      },
      async insertSailor(
        name: string,
        surname: string,
        birthday: string,
        category_id: string,
        club_id: string,
        boat_id: string,
      ) {
        try {
          return await ipcRenderer.invoke(
            'insertSailor',
            name,
            surname,
            birthday,
            category_id,
            club_id,
            boat_id,
          );
        } catch (error) {
          console.error('Error invoking insertSailor IPC:', error);
          return false;
        }
      },
      async insertClub(club_name: string, country: string) {
        try {
          return await ipcRenderer.invoke('insertClub', club_name, country);
        } catch (error) {
          console.error('Error invoking insertClub IPC:', error);
          return false;
        }
      },
      async insertBoat(sail_number: string, country: string, model: string) {
        try {
          return await ipcRenderer.invoke(
            'insertBoat',
            sail_number,
            country,
            model,
          );
        } catch (error) {
          console.error('Error invoking insertBoat IPC:', error);
          return false;
        }
      },
      async readAllCategories() {
        try {
          return await ipcRenderer.invoke('readAllCategories');
        } catch (error) {
          console.error('Error invoking readAllCategories IPC:', error);
          return false;
        }
      },
      async readAllClubs() {
        try {
          return await ipcRenderer.invoke('readAllClubs');
        } catch (error) {
          console.error('Error invoking readAllClubs IPC:', error);
          return false;
        }
      },
      async readAllBoats() {
        try {
          return await ipcRenderer.invoke('readAllBoats');
        } catch (error) {
          console.error('Error invoking readAllBoats IPC:', error);
          return false;
        }
      },
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
