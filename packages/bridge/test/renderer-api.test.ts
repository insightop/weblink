/**
 * DataBridgeRendererApi — TDD Tests
 *
 * Tests the renderer-side API that delegates IPC calls to platform adapters.
 * Uses mock adapters to verify correct channel routing and payload shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { DataBridgeRendererApi } from "../src/renderer/api.js"
import type { IpcAdapter } from "../src/renderer/adapters/types.js"
import { IPC_CHANNELS } from "../src/domain/ipc-channels.js"
import type { KitSchema } from "../src/domain/types.js"

// ─── Mock Adapter ──────────────────────────────────────────────────

function createMockAdapter() {
  const calls: Array<{ channel: string; args: unknown[] }> = []
  const adapter: IpcAdapter = {
    invoke: vi.fn(async (channel: string, ...args: unknown[]) => {
      calls.push({ channel, args })
      return null
    }),
  }
  // Expose a helper to set return value while preserving call tracking
  const setReturnValue = (value: unknown) => {
    adapter.invoke.mockImplementation(async (channel: string, ...args: unknown[]) => {
      calls.push({ channel, args })
      return value
    })
  }
  return { adapter, calls, setReturnValue }
}

// ─── Fixtures ──────────────────────────────────────────────────────

const SERIAL_SCHEMA: KitSchema = {
  kitKey: "serialkit",
  displayName: "Serial Kit",
  description: "WebSerial debugging",
  version: 1,
  stateKeys: ["connectionState", "baudRate"],
  eventTypes: ["rx_line", "tx_line"],
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("DataBridgeRendererApi", () => {
  let mock: ReturnType<typeof createMockAdapter>
  let api: DataBridgeRendererApi

  beforeEach(() => {
    mock = createMockAdapter()
    api = new DataBridgeRendererApi(mock.adapter)
  })

  // ── Kit lifecycle ──────────────────────────────────────────────

  describe("kitRegister", () => {
    it("sends KIT_REGISTER with schema payload", async () => {
      await api.kitRegister(SERIAL_SCHEMA)

      expect(mock.adapter.invoke).toHaveBeenCalledOnce()
      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.KIT_REGISTER)
      expect(mock.calls[0].args[0]).toEqual(SERIAL_SCHEMA)
    })
  })

  describe("kitUnregister", () => {
    it("sends KIT_UNREGISTER with kitKey", async () => {
      await api.kitUnregister("serialkit")

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.KIT_UNREGISTER)
      expect(mock.calls[0].args[0]).toEqual({ kitKey: "serialkit" })
    })
  })

  // ── State ──────────────────────────────────────────────────────

  describe("pushState", () => {
    it("sends STATE_UPDATE with correct payload", async () => {
      const state = { connectionState: "connected", baudRate: 115200 }
      await api.pushState("serialkit", "default", state)

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.STATE_UPDATE)
      expect(mock.calls[0].args[0]).toEqual({
        kitKey: "serialkit",
        instanceId: "default",
        state,
      })
    })
  })

  describe("getState", () => {
    it("sends STATE_GET and returns result", async () => {
      const mockState = {
        kitKey: "serialkit",
        instanceId: "default",
        state: { baudRate: 9600 },
        updatedAt: Date.now(),
      }
      // Replace the implementation to track calls AND return value
      mock.setReturnValue(mockState)

      const result = await api.getState("serialkit", "default")

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.STATE_GET)
      expect(mock.calls[0].args[0]).toEqual({
        kitKey: "serialkit",
        instanceId: "default",
      })
      expect(result).toEqual(mockState)
    })

    it("returns null when adapter returns null", async () => {
      const result = await api.getState("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("getAllStates", () => {
    it("sends STATE_GET_ALL and returns array", async () => {
      const states = [
        { kitKey: "serialkit", instanceId: "default", state: {}, updatedAt: 1 },
        { kitKey: "cankit", instanceId: "default", state: {}, updatedAt: 2 },
      ]
      mock.setReturnValue(states)

      const result = await api.getAllStates()

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.STATE_GET_ALL)
      expect(result).toHaveLength(2)
    })
  })

  // ── Events ─────────────────────────────────────────────────────

  describe("appendEvent", () => {
    it("sends EVENT_APPEND with full payload", async () => {
      await api.appendEvent("serialkit", "default", "rx_line", {
        text: "hello",
      })

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.EVENT_APPEND)
      expect(mock.calls[0].args[0]).toEqual({
        kitKey: "serialkit",
        instanceId: "default",
        type: "rx_line",
        payload: { text: "hello" },
      })
    })
  })

  describe("getEvents", () => {
    it("sends EVENTS_GET with query params", async () => {
      mock.setReturnValue([])

      await api.getEvents("serialkit", {
        type: "rx_line",
        since: 1000,
        limit: 50,
      })

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.EVENTS_GET)
      expect(mock.calls[0].args[0]).toEqual({
        kitKey: "serialkit",
        type: "rx_line",
        since: 1000,
        limit: 50,
      })
    })
  })

  // ── Config ─────────────────────────────────────────────────────

  describe("pushConfig", () => {
    it("sends CONFIG_UPDATE with config payload", async () => {
      const config = { baudRate: 115200, dataBits: 8 }
      await api.pushConfig("serialkit", config)

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.CONFIG_UPDATE)
      expect(mock.calls[0].args[0]).toEqual({
        kitKey: "serialkit",
        config,
      })
    })
  })

  describe("getConfig", () => {
    it("sends CONFIG_GET and returns result", async () => {
      const mockConfig = {
        kitKey: "serialkit",
        config: { baudRate: 9600 },
        updatedAt: Date.now(),
      }
      mock.setReturnValue(mockConfig)

      const result = await api.getConfig("serialkit")

      expect(mock.calls[0].channel).toBe(IPC_CHANNELS.CONFIG_GET)
      expect(mock.calls[0].args[0]).toEqual({ kitKey: "serialkit" })
      expect(result).toEqual(mockConfig)
    })
  })
})
