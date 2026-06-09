import { contextBridge, ipcRenderer } from "electron";
import * as Sentry from "@sentry/electron/preload";

Sentry.preload();

contextBridge.exposeInMainWorld("platform", {
  isDesktop: true,
  /**
   * IPC invoke bridge — allows renderer to call main process handlers.
   * Only channels registered via ipcMain.handle() are callable.
   */
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),
});
