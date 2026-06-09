/**
 * @weblink/bridge — DataBridgeStorage
 *
 * SQLite-backed implementation of BridgeIpcContract for Electron main process.
 * Uses better-sqlite3 (synchronous API) wrapped in async methods to match
 * the BridgeIpcContract interface.
 *
 * WAL mode enables concurrent readers while this class holds the single writer.
 */

import type Database from "better-sqlite3"
import type { BridgeIpcContract } from "../domain/ipc-contract.js"
import { SQLITE_SCHEMA } from "../domain/sqlite-schema.js"
import type {
  EventQueryOptions,
  KitConfig,
  KitEventEntry,
  KitSchema,
  KitState,
} from "../domain/types.js"

export class DataBridgeStorage implements BridgeIpcContract {
  private db: Database.Database
  private closed = false

  /**
   * Create a DataBridgeStorage from a file path.
   * Convenience factory that handles the dynamic import of better-sqlite3.
   */
  static async create(dbPath: string): Promise<DataBridgeStorage> {
    const Database = (await import("better-sqlite3")).default
    const db = new Database(dbPath)
    return new DataBridgeStorage(db)
  }

  // Prepared statements (lazy-initialized)
  private stmts!: {
    insertSchema: Database.Statement
    deleteSchema: Database.Statement
    upsertState: Database.Statement
    selectState: Database.Statement
    selectAllStates: Database.Statement
    insertEvent: Database.Statement
    selectEvents: Database.Statement
    selectEventsByType: Database.Statement
    upsertConfig: Database.Statement
    selectConfig: Database.Statement
  }

  constructor(db: Database.Database) {
    this.db = db
    this.db.pragma("journal_mode = WAL")
    this.db.exec(SQLITE_SCHEMA)
    this.prepareStatements()
  }

  // ── Kit lifecycle ──────────────────────────────────────────────

  async kitRegister(schema: KitSchema): Promise<void> {
    if (this.closed) return
    const now = Date.now()
    this.stmts.insertSchema.run(
      schema.kitKey,
      schema.displayName,
      schema.description,
      schema.version,
      JSON.stringify(schema.stateKeys),
      JSON.stringify(schema.eventTypes),
      now,
      now,
    )
  }

  async kitUnregister(kitKey: string): Promise<void> {
    if (this.closed) return
    // Delete schema + cascading state, events, config
    const txn = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM kit_state WHERE kit_key = ?")
        .run(kitKey)
      this.db
        .prepare("DELETE FROM kit_events WHERE kit_key = ?")
        .run(kitKey)
      this.db
        .prepare("DELETE FROM kit_config WHERE kit_key = ?")
        .run(kitKey)
      this.stmts.deleteSchema.run(kitKey)
    })
    txn()
  }

  // ── State ──────────────────────────────────────────────────────

  async pushState(
    kitKey: string,
    instanceId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    if (this.closed) return
    this.stmts.upsertState.run(
      kitKey,
      instanceId,
      JSON.stringify(state),
      Date.now(),
    )
  }

  async getState(
    kitKey: string,
    instanceId?: string,
  ): Promise<KitState | null> {
    if (this.closed) return null
    const id = instanceId ?? "default"
    const row = this.stmts.selectState.get(kitKey, id) as
      | {
          kit_key: string
          instance_id: string
          state: string
          updated_at: number
        }
      | undefined

    if (!row) return null
    return {
      kitKey: row.kit_key,
      instanceId: row.instance_id,
      state: JSON.parse(row.state),
      updatedAt: row.updated_at,
    }
  }

  async getAllStates(): Promise<KitState[]> {
    if (this.closed) return []
    const rows = this.stmts.selectAllStates.all() as Array<{
      kit_key: string
      instance_id: string
      state: string
      updated_at: number
    }>
    return rows.map((r) => ({
      kitKey: r.kit_key,
      instanceId: r.instance_id,
      state: JSON.parse(r.state),
      updatedAt: r.updated_at,
    }))
  }

  // ── Events ─────────────────────────────────────────────────────

  async appendEvent(
    kitKey: string,
    instanceId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.closed) return
    this.stmts.insertEvent.run(
      kitKey,
      instanceId,
      type,
      Date.now(),
      JSON.stringify(payload),
    )
  }

  async getEvents(
    kitKey: string,
    opts?: EventQueryOptions,
  ): Promise<KitEventEntry[]> {
    if (this.closed) return []
    const limit = opts?.limit ?? 100
    const rows = (
      opts?.type
        ? this.stmts.selectEventsByType.all(
            kitKey,
            opts.type,
            opts?.since ?? 0,
            limit,
          )
        : this.stmts.selectEvents.all(kitKey, opts?.since ?? 0, limit)
    ) as Array<{
      id: number
      kit_key: string
      instance_id: string
      type: string
      ts: number
      payload: string
    }>

    return rows.map((r) => ({
      id: r.id,
      kitKey: r.kit_key,
      instanceId: r.instance_id,
      type: r.type,
      ts: r.ts,
      payload: JSON.parse(r.payload),
    }))
  }

  // ── Config ─────────────────────────────────────────────────────

  async pushConfig(
    kitKey: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    if (this.closed) return
    this.stmts.upsertConfig.run(kitKey, JSON.stringify(config), Date.now())
  }

  async getConfig(kitKey: string): Promise<KitConfig | null> {
    if (this.closed) return null
    const row = this.stmts.selectConfig.get(kitKey) as
      | { kit_key: string; config: string; updated_at: number }
      | undefined
    if (!row) return null
    return {
      kitKey: row.kit_key,
      config: JSON.parse(row.config),
      updatedAt: row.updated_at,
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  close(): void {
    if (this.closed) return
    this.closed = true
    this.db.close()
  }

  // ── Internal ───────────────────────────────────────────────────

  private prepareStatements(): void {
    this.stmts = {
      insertSchema: this.db.prepare(`
        INSERT OR REPLACE INTO kit_schemas
          (kit_key, display_name, description, version, state_keys, event_types, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      deleteSchema: this.db.prepare(
        "DELETE FROM kit_schemas WHERE kit_key = ?",
      ),

      upsertState: this.db.prepare(`
        INSERT INTO kit_state (kit_key, instance_id, state, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (kit_key, instance_id)
        DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
      `),

      selectState: this.db.prepare(
        "SELECT kit_key, instance_id, state, updated_at FROM kit_state WHERE kit_key = ? AND instance_id = ?",
      ),

      selectAllStates: this.db.prepare(
        "SELECT kit_key, instance_id, state, updated_at FROM kit_state",
      ),

      insertEvent: this.db.prepare(`
        INSERT INTO kit_events (kit_key, instance_id, type, ts, payload)
        VALUES (?, ?, ?, ?, ?)
      `),

      selectEvents: this.db.prepare(`
        SELECT id, kit_key, instance_id, type, ts, payload
        FROM kit_events
        WHERE kit_key = ? AND ts >= ?
        ORDER BY id DESC
        LIMIT ?
      `),

      selectEventsByType: this.db.prepare(`
        SELECT id, kit_key, instance_id, type, ts, payload
        FROM kit_events
        WHERE kit_key = ? AND type = ? AND ts >= ?
        ORDER BY id DESC
        LIMIT ?
      `),

      upsertConfig: this.db.prepare(`
        INSERT INTO kit_config (kit_key, config, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT (kit_key)
        DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at
      `),

      selectConfig: this.db.prepare(
        "SELECT kit_key, config, updated_at FROM kit_config WHERE kit_key = ?",
      ),
    }
  }
}
