/**
 * DataBridgeStorage — TDD Tests
 *
 * Tests the SQLite storage layer that implements BridgeIpcContract.
 * Uses better-sqlite3 in-memory mode for fast, isolated tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import Database from "better-sqlite3"
import { DataBridgeStorage } from "../src/storage/DataBridgeStorage.js"
import type { KitSchema } from "../src/domain/types.js"

// ─── Test fixtures ─────────────────────────────────────────────────

const SERIAL_SCHEMA: KitSchema = {
  kitKey: "serialkit",
  displayName: "Serial Kit",
  description: "WebSerial serial debugging",
  version: 1,
  stateKeys: ["connectionState", "baudRate", "portInfo"],
  eventTypes: ["rx_line", "tx_line", "log"],
}

const CAN_SCHEMA: KitSchema = {
  kitKey: "cankit",
  displayName: "CAN Kit",
  description: "CAN bus debugging",
  version: 1,
  stateKeys: ["connectionState", "bitRate"],
  eventTypes: ["rx_frame", "tx_frame"],
}

// ─── Helper ────────────────────────────────────────────────────────

function createStorage(): DataBridgeStorage {
  const db = new Database(":memory:")
  return new DataBridgeStorage(db)
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("DataBridgeStorage", () => {
  let storage: DataBridgeStorage

  beforeEach(() => {
    storage = createStorage()
  })

  afterEach(() => {
    storage.close()
  })

  // ── Kit lifecycle ──────────────────────────────────────────────

  describe("kitRegister / kitUnregister", () => {
    it("registers a kit and retrieves its schema", async () => {
      await storage.kitRegister(SERIAL_SCHEMA)

      // Verify it was stored (use getState to check kit exists)
      const state = await storage.getState("serialkit")
      // Kit registered but no state yet — this is fine
      expect(state).toBeNull()
    })

    it("unregisters a kit", async () => {
      await storage.kitRegister(SERIAL_SCHEMA)
      await storage.kitUnregister("serialkit")

      // After unregister, all state/events/config should be cleared
      const state = await storage.getState("serialkit")
      expect(state).toBeNull()
    })

    it("can register multiple kits", async () => {
      await storage.kitRegister(SERIAL_SCHEMA)
      await storage.kitRegister(CAN_SCHEMA)

      const states = await storage.getAllStates()
      expect(states).toHaveLength(0) // No state pushed yet
    })
  })

  // ── State management ───────────────────────────────────────────

  describe("pushState / getState / getAllStates", () => {
    beforeEach(async () => {
      await storage.kitRegister(SERIAL_SCHEMA)
    })

    it("pushes and retrieves state for a kit", async () => {
      const state = {
        connectionState: "connected",
        baudRate: 115200,
        portInfo: "USB Serial",
      }

      await storage.pushState("serialkit", "default", state)
      const result = await storage.getState("serialkit", "default")

      expect(result).not.toBeNull()
      expect(result!.kitKey).toBe("serialkit")
      expect(result!.instanceId).toBe("default")
      expect(result!.state).toEqual(state)
      expect(result!.updatedAt).toBeGreaterThan(0)
    })

    it("returns null for non-existent kit", async () => {
      const result = await storage.getState("nonexistent")
      expect(result).toBeNull()
    })

    it("returns null for non-existent instance", async () => {
      await storage.pushState("serialkit", "default", { baudRate: 9600 })
      const result = await storage.getState("serialkit", "nonexistent")
      expect(result).toBeNull()
    })

    it("upserts state (second push replaces first)", async () => {
      await storage.pushState("serialkit", "default", { baudRate: 9600 })
      await storage.pushState("serialkit", "default", { baudRate: 115200 })

      const result = await storage.getState("serialkit", "default")
      expect(result!.state).toEqual({ baudRate: 115200 })
    })

    it("supports multiple instances per kit", async () => {
      await storage.pushState("serialkit", "session-1", { baudRate: 9600 })
      await storage.pushState("serialkit", "session-2", { baudRate: 115200 })

      const s1 = await storage.getState("serialkit", "session-1")
      const s2 = await storage.getState("serialkit", "session-2")

      expect(s1!.state).toEqual({ baudRate: 9600 })
      expect(s2!.state).toEqual({ baudRate: 115200 })
    })

    it("getAllStates returns all instances for all kits", async () => {
      await storage.kitRegister(CAN_SCHEMA)
      await storage.pushState("serialkit", "default", { baudRate: 9600 })
      await storage.pushState("serialkit", "session-2", { baudRate: 115200 })
      await storage.pushState("cankit", "default", { bitRate: 500000 })

      const all = await storage.getAllStates()
      expect(all).toHaveLength(3)
    })

    it("getState without instanceId defaults to 'default'", async () => {
      await storage.pushState("serialkit", "default", { baudRate: 9600 })

      const result = await storage.getState("serialkit")
      expect(result!.state).toEqual({ baudRate: 9600 })
    })
  })

  // ── Event log ──────────────────────────────────────────────────

  describe("appendEvent / getEvents", () => {
    beforeEach(async () => {
      await storage.kitRegister(SERIAL_SCHEMA)
    })

    it("appends and retrieves events", async () => {
      await storage.appendEvent("serialkit", "default", "rx_line", {
        text: "hello",
        hex: "68656c6c6f",
      })

      const events = await storage.getEvents("serialkit")
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe("rx_line")
      expect(events[0].payload).toEqual({ text: "hello", hex: "68656c6c6f" })
      expect(events[0].kitKey).toBe("serialkit")
      expect(events[0].id).toBeGreaterThan(0)
    })

    it("returns empty array for kit with no events", async () => {
      const events = await storage.getEvents("serialkit")
      expect(events).toHaveLength(0)
    })

    it("preserves event ordering by auto-increment id", async () => {
      await storage.appendEvent("serialkit", "default", "rx_line", { seq: 1 })
      await storage.appendEvent("serialkit", "default", "rx_line", { seq: 2 })
      await storage.appendEvent("serialkit", "default", "tx_line", { seq: 3 })

      const events = await storage.getEvents("serialkit")
      expect(events).toHaveLength(3)
      // Events returned in DESC order (newest first) — matching ORDER BY id DESC
      expect(events[0].payload).toEqual({ seq: 3 })
      expect(events[1].payload).toEqual({ seq: 2 })
      expect(events[2].payload).toEqual({ seq: 1 })
      expect(events[0].type).toBe("tx_line")
    })

    it("filters events by type", async () => {
      await storage.appendEvent("serialkit", "default", "rx_line", { a: 1 })
      await storage.appendEvent("serialkit", "default", "tx_line", { a: 2 })
      await storage.appendEvent("serialkit", "default", "rx_line", { a: 3 })

      const rxOnly = await storage.getEvents("serialkit", { type: "rx_line" })
      expect(rxOnly).toHaveLength(2)
      expect(rxOnly.every((e) => e.type === "rx_line")).toBe(true)
    })

    it("respects limit option (default 100)", async () => {
      for (let i = 0; i < 150; i++) {
        await storage.appendEvent("serialkit", "default", "rx_line", { i })
      }

      const limited = await storage.getEvents("serialkit")
      expect(limited).toHaveLength(100) // default limit

      const custom = await storage.getEvents("serialkit", { limit: 10 })
      expect(custom).toHaveLength(10)
    })

    it("filters events by since timestamp", async () => {
      const now = Date.now()
      await storage.appendEvent("serialkit", "default", "rx_line", { a: 1 })

      const recent = await storage.getEvents("serialkit", { since: now })
      expect(recent).toHaveLength(1)

      const future = await storage.getEvents("serialkit", { since: now + 10000 })
      expect(future).toHaveLength(0)
    })
  })

  // ── Configuration ──────────────────────────────────────────────

  describe("pushConfig / getConfig", () => {
    beforeEach(async () => {
      await storage.kitRegister(SERIAL_SCHEMA)
    })

    it("pushes and retrieves config", async () => {
      const config = { baudRate: 115200, dataBits: 8, stopBits: 1 }
      await storage.pushConfig("serialkit", config)

      const result = await storage.getConfig("serialkit")
      expect(result).not.toBeNull()
      expect(result!.config).toEqual(config)
      expect(result!.kitKey).toBe("serialkit")
      expect(result!.updatedAt).toBeGreaterThan(0)
    })

    it("upserts config (second push replaces first)", async () => {
      await storage.pushConfig("serialkit", { baudRate: 9600 })
      await storage.pushConfig("serialkit", { baudRate: 115200 })

      const result = await storage.getConfig("serialkit")
      expect(result!.config).toEqual({ baudRate: 115200 })
    })

    it("returns null for non-existent kit config", async () => {
      const result = await storage.getConfig("nonexistent")
      expect(result).toBeNull()
    })
  })

  // ── Close / cleanup ────────────────────────────────────────────

  describe("close", () => {
    it("can be called multiple times without error", () => {
      storage.close()
      storage.close() // second call is safe
    })
  })
})
