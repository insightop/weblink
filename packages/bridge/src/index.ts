/**
 * @weblink/bridge — Default export (renderer-safe)
 *
 * Exports domain types + renderer API. This entry point must NEVER
 * import better-sqlite3, @modelcontextprotocol/sdk, or any Node.js
 * native modules. Safe for web build tree-shaking.
 */

// Domain
export type {
  EventQueryOptions,
  KitConfig,
  KitEventEntry,
  KitSchema,
  KitState,
} from "./domain/types.js"
export type { BridgeIpcContract } from "./domain/ipc-contract.js"
export { IPC_CHANNELS } from "./domain/ipc-channels.js"

// Renderer
export { DataBridgeRendererApi } from "./renderer/api.js"
export { useKitDataBridge } from "./renderer/composable.js"
