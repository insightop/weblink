/**
 * @weblink/bridge — Electron Registration
 *
 * Provides helper functions for setting up the bridge in Electron main process.
 * The Electron app calls these functions — the bridge package does NOT
 * import electron directly (decoupled).
 *
 * Usage in Electron main/index.ts:
 * ```ts
 * import { DataBridgeStorage, registerIpcHandlers } from '@weblink/bridge/main'
 * import { ipcMain } from 'electron'
 *
 * const storage = DataBridgeStorage.create(dbPath)
 * registerIpcHandlers(ipcMain, storage)
 * ```
 */

import type { IpcMain } from "electron"
import { IPC_CHANNELS } from "../domain/ipc-channels.js"
import { DataBridgeStorage } from "../storage/DataBridgeStorage.js"

/**
 * Register IPC handlers that bridge renderer → storage.
 * Must be called in Electron main process with a real ipcMain reference.
 */
export function registerIpcHandlers(
  ipcMain: IpcMain,
  storage: DataBridgeStorage,
): void {
  ipcMain.handle(IPC_CHANNELS.KIT_REGISTER, (_event, schema) =>
    storage.kitRegister(schema),
  )

  ipcMain.handle(IPC_CHANNELS.KIT_UNREGISTER, (_event, payload) =>
    storage.kitUnregister(payload.kitKey),
  )

  ipcMain.handle(IPC_CHANNELS.STATE_UPDATE, (_event, payload) =>
    storage.pushState(payload.kitKey, payload.instanceId, payload.state),
  )

  ipcMain.handle(IPC_CHANNELS.STATE_GET, (_event, payload) =>
    storage.getState(payload.kitKey, payload.instanceId),
  )

  ipcMain.handle(IPC_CHANNELS.STATE_GET_ALL, () => storage.getAllStates())

  ipcMain.handle(IPC_CHANNELS.EVENT_APPEND, (_event, payload) =>
    storage.appendEvent(
      payload.kitKey,
      payload.instanceId,
      payload.type,
      payload.payload,
    ),
  )

  ipcMain.handle(IPC_CHANNELS.EVENTS_GET, (_event, payload) =>
    storage.getEvents(payload.kitKey, {
      type: payload.type,
      since: payload.since,
      limit: payload.limit,
    }),
  )

  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, (_event, payload) =>
    storage.pushConfig(payload.kitKey, payload.config),
  )

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_event, payload) =>
    storage.getConfig(payload.kitKey),
  )

  console.log("[bridge] IPC handlers registered")
}

// Re-export DataBridgeStorage for convenience
export { DataBridgeStorage } from "../storage/DataBridgeStorage.js"
