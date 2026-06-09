/**
 * @weblink/bridge/main — Main process exports (Electron)
 *
 * This entry point imports better-sqlite3 (Node.js native module).
 * Only import this in Electron main process or Node.js environments.
 * NEVER import from renderer/web code.
 */

export { DataBridgeStorage } from "./storage/DataBridgeStorage.js"
export { initBridge } from "./electron/register.js"
