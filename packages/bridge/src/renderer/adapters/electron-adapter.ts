/**
 * @weblink/bridge — Electron IPC Adapter
 *
 * Routes IPC calls through window.platform.invoke() (exposed by preload).
 */

import type { IpcAdapter } from "./types.js"

export class ElectronAdapter implements IpcAdapter {
  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return window.platform!.invoke!(channel, ...args)
  }
}
