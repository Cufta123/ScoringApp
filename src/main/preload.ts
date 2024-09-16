// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example' | 'readAllPerson' | 'insertPerson';


const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
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
      async insertPerson(name: string, surname: string, birthdate: string, category: string, club: string, sail_number: string, model: string) {
        try {
          return await ipcRenderer.invoke('insertPerson', name, surname, birthdate, category, club, sail_number, model);
        } catch (error) {
          console.error('Error invoking insertPerson IPC:', error);
        }
      }
    }
  }
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
