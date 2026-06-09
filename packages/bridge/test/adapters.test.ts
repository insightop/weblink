/**
 * IPC Adapters — Tests
 *
 * Tests for the Tauri adapter channel name conversion.
 * Electron and Noop adapters are simple enough to verify in integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { TauriAdapter } from "../src/renderer/adapters/tauri-adapter.js"
import { NoopAdapter } from "../src/renderer/adapters/noop-adapter.js"

describe("TauriAdapter", () => {
  let adapter: TauriAdapter
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Mock window.__TAURI__.core.invoke
    mockInvoke = vi.fn().mockResolvedValue(null)
    ;(globalThis as any).window = {
      __TAURI__: {
        core: {
          invoke: mockInvoke,
        },
      },
    }
    adapter = new TauriAdapter()
  })

  it("converts colon-separated channels to underscore commands", async () => {
    await adapter.invoke("bridge:kit:register", { kitKey: "serialkit" })

    expect(mockInvoke).toHaveBeenCalledWith("bridge_kit_register", {
      kitKey: "serialkit",
    })
  })

  it("converts STATE_UPDATE channel correctly", async () => {
    await adapter.invoke("bridge:state:update", {
      kitKey: "serialkit",
      instanceId: "default",
      state: {},
    })

    expect(mockInvoke).toHaveBeenCalledWith("bridge_state_update", {
      kitKey: "serialkit",
      instanceId: "default",
      state: {},
    })
  })

  it("passes undefined args as no payload", async () => {
    await adapter.invoke("bridge:state:get:all")

    expect(mockInvoke).toHaveBeenCalledWith("bridge_state_get_all", undefined)
  })
})

describe("NoopAdapter", () => {
  it("returns null for any call", async () => {
    const adapter = new NoopAdapter()

    const result1 = await adapter.invoke("bridge:kit:register", {})
    const result2 = await adapter.invoke("bridge:state:get", { kitKey: "test" })
    const result3 = await adapter.invoke("bridge:events:get")

    expect(result1).toBeNull()
    expect(result2).toBeNull()
    expect(result3).toBeNull()
  })
})
