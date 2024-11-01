/* eslint-disable no-console */
/* eslint-disable camelcase */
// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'readAllSailors'
  | 'insertSailor'
  | 'readAllCategories'
  | 'readAllClubs'
  | 'insertClub'
  | 'insertBoat'
  | 'readAllBoats'
  | 'readAllEvents'
  | 'insertEvent'
  | 'associateBoatWithEvent'
  | 'readBoatsByEvent'
  | 'removeBoatFromEvent';

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
      ) {
        try {
          return await ipcRenderer.invoke(
            'insertSailor',
            name,
            surname,
            birthday,
            category_id,
            club_id,
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
      async insertBoat(
        sail_number: string,
        country: string,
        model: string,
        sailor_id: string,
      ) {
        try {
          return await ipcRenderer.invoke(
            'insertBoat',
            sail_number,
            country,
            model,
            sailor_id,
          );
        } catch (error) {
          if (error === 'SQLITE_CONSTRAINT') {
            console.error('Error: The sail number already exists.');
            // eslint-disable-next-line no-alert
            alert(
              'The sail number already exists. Please use a different sail number.',
            );
          } else {
            console.error('Error invoking insertBoat IPC:', error);
          }
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
    eventDB: {
      async readAllEvents() {
        try {
          return await ipcRenderer.invoke('readAllEvents');
        } catch (error) {
          console.error('Error invoking readAllEvents IPC: ', error);
          return false;
        }
      },
      async insertEvent(
        event_name: string,
        event_location: string,
        start_date: string,
        end_date: string,
      ) {
        try {
          return await ipcRenderer.invoke(
            'insertEvent',
            event_name,
            event_location,
            start_date,
            end_date,
          );
        } catch (error) {
          console.error('Error invoking insertEvent IPC:', error);
          return false;
        }
      },
      async associateBoatWithEvent(boat_id: string, event_id: string) {
        try {
          return await ipcRenderer.invoke(
            'associateBoatWithEvent',
            boat_id,
            event_id,
          );
        } catch (error) {
          console.error('Error invoking associateBoatWithEvent IPC:', error);
          return false;
        }
      },
      async readBoatsByEvent(event_id: string) {
        try {
          return await ipcRenderer.invoke('readBoatsByEvent', event_id);
        } catch (error) {
          console.error('Error invoking readBoatsByEvent IPC:', error);
          return false;
        }
      },
      async removeBoatFromEvent(boat_id: string, event_id: string) {
        try {
          return await ipcRenderer.invoke(
            'removeBoatFromEvent',
            boat_id,
            event_id,
          );
        } catch (error) {
          console.error('Error invoking removeBoatFromEvent IPC:', error);
          return false;
        }
      },
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
