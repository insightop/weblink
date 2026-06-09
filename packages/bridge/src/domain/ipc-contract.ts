/**
 * @weblink/bridge — IPC Contract
 *
 * THE source-of-truth interface that both Electron (TypeScript) and
 * Tauri (Rust) must implement identically. Every method here maps 1:1
 * to an IPC channel and a SQLite operation.
 */

import type {
  EventQueryOptions,
  KitConfig,
  KitEventEntry,
  KitSchema,
  KitState,
} from "./types.js"

export interface BridgeIpcContract {
  /** Register a kit's schema on startup */
  kitRegister(schema: KitSchema): Promise<void>
  /** Unregister a kit (e.g. on unmount) */
  kitUnregister(kitKey: string): Promise<void>

  /** Upsert a kit's runtime state */
  pushState(
    kitKey: string,
    instanceId: string,
    state: Record<string, unknown>,
  ): Promise<void>
  /** Get current state for a kit (optionally by instance) */
  getState(kitKey: string, instanceId?: string): Promise<KitState | null>
  /** Get state for all registered kits */
  getAllStates(): Promise<KitState[]>

  /** Append a single event to the log */
  appendEvent(
    kitKey: string,
    instanceId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void>
  /** Query events for a kit */
  getEvents(
    kitKey: string,
    opts?: EventQueryOptions,
  ): Promise<KitEventEntry[]>

  /** Upsert kit configuration */
  pushConfig(
    kitKey: string,
    config: Record<string, unknown>,
  ): Promise<void>
  /** Get kit configuration */
  getConfig(kitKey: string): Promise<KitConfig | null>
}
