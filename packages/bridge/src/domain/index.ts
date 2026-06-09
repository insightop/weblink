/**
 * @weblink/bridge — Domain layer barrel export
 */

export type {
  EventQueryOptions,
  KitConfig,
  KitEventEntry,
  KitSchema,
  KitState,
} from "./types.js"

export type { BridgeIpcContract } from "./ipc-contract.js"

export { IPC_CHANNELS } from "./ipc-channels.js"
export type { IpcChannel } from "./ipc-channels.js"

export { SQLITE_SCHEMA } from "./sqlite-schema.js"
