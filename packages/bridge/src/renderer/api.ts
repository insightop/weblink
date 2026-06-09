/**
 * @weblink/bridge — Renderer API
 *
 * Platform-aware implementation of BridgeIpcContract that runs in the web page.
 * Detects the runtime environment (Electron / Tauri / Web) and routes
 * IPC calls through the appropriate adapter.
 *
 * IMPORTANT: This file must never import Node.js modules (better-sqlite3, etc.).
 */

import type { BridgeIpcContract } from "../domain/ipc-contract.js"
import type {
  EventQueryOptions,
  KitConfig,
  KitEventEntry,
  KitSchema,
  KitState,
} from "../domain/types.js"
import { IPC_CHANNELS } from "../domain/ipc-channels.js"
import type { IpcAdapter } from "./adapters/types.js"
import { ElectronAdapter } from "./adapters/electron-adapter.js"
import { TauriAdapter } from "./adapters/tauri-adapter.js"
import { NoopAdapter } from "./adapters/noop-adapter.js"

// ─── Window type augmentation ──────────────────────────────────────

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>
    platform?: {
      isDesktop?: boolean
      invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

// ─── Platform detection ────────────────────────────────────────────

function createAdapter(): IpcAdapter {
  if (window.__TAURI__) return new TauriAdapter()
  if (window.platform?.isDesktop && window.platform.invoke)
    return new ElectronAdapter()
  return new NoopAdapter()
}

// ─── DataBridgeRendererApi ─────────────────────────────────────────

export class DataBridgeRendererApi implements BridgeIpcContract {
  private adapter: IpcAdapter

  constructor(adapter?: IpcAdapter) {
    this.adapter = adapter ?? createAdapter()
  }

  // ── Kit lifecycle ──────────────────────────────────────────────

  async kitRegister(schema: KitSchema): Promise<void> {
    await this.adapter.invoke(IPC_CHANNELS.KIT_REGISTER, schema)
  }

  async kitUnregister(kitKey: string): Promise<void> {
    await this.adapter.invoke(IPC_CHANNELS.KIT_UNREGISTER, { kitKey })
  }

  // ── State ──────────────────────────────────────────────────────

  async pushState(
    kitKey: string,
    instanceId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    await this.adapter.invoke(IPC_CHANNELS.STATE_UPDATE, {
      kitKey,
      instanceId,
      state,
    })
  }

  async getState(
    kitKey: string,
    instanceId?: string,
  ): Promise<KitState | null> {
    const result = await this.adapter.invoke(IPC_CHANNELS.STATE_GET, {
      kitKey,
      instanceId,
    })
    return (result as KitState | null) ?? null
  }

  async getAllStates(): Promise<KitState[]> {
    const result = await this.adapter.invoke(IPC_CHANNELS.STATE_GET_ALL)
    return (result as KitState[]) ?? []
  }

  // ── Events ─────────────────────────────────────────────────────

  async appendEvent(
    kitKey: string,
    instanceId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.adapter.invoke(IPC_CHANNELS.EVENT_APPEND, {
      kitKey,
      instanceId,
      type,
      payload,
    })
  }

  async getEvents(
    kitKey: string,
    opts?: EventQueryOptions,
  ): Promise<KitEventEntry[]> {
    const result = await this.adapter.invoke(IPC_CHANNELS.EVENTS_GET, {
      kitKey,
      ...opts,
    })
    return (result as KitEventEntry[]) ?? []
  }

  // ── Config ─────────────────────────────────────────────────────

  async pushConfig(
    kitKey: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    await this.adapter.invoke(IPC_CHANNELS.CONFIG_UPDATE, {
      kitKey,
      config,
    })
  }

  async getConfig(kitKey: string): Promise<KitConfig | null> {
    const result = await this.adapter.invoke(IPC_CHANNELS.CONFIG_GET, {
      kitKey,
    })
    return (result as KitConfig | null) ?? null
  }
}
