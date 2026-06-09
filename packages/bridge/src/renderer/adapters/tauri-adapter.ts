/**
 * @weblink/bridge — Tauri IPC Adapter
 *
 * Routes IPC calls through window.__TAURI__.core.invoke() (Tauri v2 API).
 */

import type { IpcAdapter } from "./types.js"

interface TauriInvoke {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>
}

interface TauriGlobal {
  core: TauriInvoke
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal
  }
}

export class TauriAdapter implements IpcAdapter {
  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    // Tauri v2: window.__TAURI__.core.invoke(cmd, args)
    // We convert channel names to Tauri command names:
    // "bridge:kit:register" → "bridge_kit_register"
    const cmd = channel.replace(/:/g, "_")
    const payload = args.length > 0 ? args[0] : undefined
    return window.__TAURI__!.core.invoke(cmd, payload as Record<string, unknown>)
  }
}
