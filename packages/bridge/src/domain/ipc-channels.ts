/**
 * @weblink/bridge — IPC Channel Names
 *
 * Canonical channel name constants used by both IPC handlers (main process)
 * and renderer adapters. Prevents string drift between platforms.
 */

export const IPC_CHANNELS = {
  /** Kit lifecycle */
  KIT_REGISTER: "bridge:kit:register",
  KIT_UNREGISTER: "bridge:kit:unregister",

  /** State read/write */
  STATE_UPDATE: "bridge:state:update",
  STATE_GET: "bridge:state:get",
  STATE_GET_ALL: "bridge:state:get:all",

  /** Event log */
  EVENT_APPEND: "bridge:event:append",
  EVENTS_GET: "bridge:events:get",

  /** Configuration */
  CONFIG_UPDATE: "bridge:config:update",
  CONFIG_GET: "bridge:config:get",
} as const

export type IpcChannel =
  (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
