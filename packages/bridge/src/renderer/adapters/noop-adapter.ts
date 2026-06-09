/**
 * @weblink/bridge — Noop IPC Adapter
 *
 * Used in web mode (not Electron or Tauri). All calls silently return null/undefined.
 * This ensures kits can use useKitDataBridge without any runtime cost in the browser.
 */

import type { IpcAdapter } from "./types.js"

export class NoopAdapter implements IpcAdapter {
  async invoke(_channel: string, ..._args: unknown[]): Promise<unknown> {
    return null
  }
}
