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
  | 'removeBoatFromEvent'
  | 'readAllHeats'
  | 'insertHeat'
  | 'readAllRaces'
  | 'insertRace'
  | 'readAllScores'
  | 'insertScore'
  | 'updateScore'
  | 'deleteScore';

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
      async updateSailor(
        sailor_id: string,
        name: string,
        surname: string,
        birthday: string,
        category_id: string,
        club_id: string,
      ) {
        try {
          return await ipcRenderer.invoke(
            'updateSailor',
            sailor_id,
            name,
            surname,
            birthday,
            category_id,
            club_id,
          );
        } catch (error) {
          console.error('Error invoking updateSailor IPC:', error);
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
    heatRaceDB: {
      async readAllHeats(event_id: string) {
        try {
          return await ipcRenderer.invoke('readAllHeats', event_id);
        } catch (error) {
          console.error('Error invoking readAllHeats IPC:', error);
          return false;
        }
      },
      async insertHeat(event_id: string, heat_name: string, heat_type: string) {
        try {
          return await ipcRenderer.invoke('insertHeat', event_id, heat_name, heat_type);
        } catch (error) {
          console.error('Error invoking insertHeat IPC:', error);
          return false;
        }
      },
      async readAllRaces(heat_id: string) {
        try {
          return await ipcRenderer.invoke('readAllRaces', heat_id);
        } catch (error) {
          console.error('Error invoking readAllRaces IPC:', error);
          return false;
        }
      },
      async insertRace(heat_id: string, race_number: number) {
        try {
          return await ipcRenderer.invoke('insertRace', heat_id, race_number);
        } catch (error) {
          console.error('Error invoking insertRace IPC:', error);
          return false;
        }
      },
      async readAllScores(race_id: string) {
        try {
          return await ipcRenderer.invoke('readAllScores', race_id);
        } catch (error) {
          console.error('Error invoking readAllScores IPC:', error);
          return false;
        }
      },
      async insertScore(race_id: string, boat_id: string, position: string, points: number, status: string) {
        try {
          return await ipcRenderer.invoke('insertScore', race_id, boat_id, position, points, status);
        } catch (error) {
          console.error('Error invoking insertScore IPC:', error);
          return false;
        }
      },
      async updateScore(score_id: string, position: string, points: number, status: string) {
        try {
          return await ipcRenderer.invoke('updateScore', score_id, position, points, status);
        } catch (error) {
          console.error('Error invoking updateScore IPC:', error);
          return false;
        }
      },
      async deleteScore(score_id: string) {
        try {
          return await ipcRenderer.invoke('deleteScore', score_id);
        } catch (error) {
          console.error('Error invoking deleteScore IPC:', error);
          return false;
        }
      },
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
