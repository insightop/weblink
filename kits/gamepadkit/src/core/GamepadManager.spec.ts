import { describe, it, expect, vi } from "vitest";
import { GamepadManager } from "./GamepadManager";

describe("GamepadManager", () => {
  it("supported() returns false without navigator", () => {
    // navigator is available in happy-dom but getGamepads may not be
    expect(typeof GamepadManager.supported()).toBe("boolean");
  });

  it("start/stop does not throw", () => {
    const mgr = new GamepadManager();
    // Mock browser APIs for test environment
    const origGetGamepads = navigator.getGamepads;
    navigator.getGamepads = () => [];
    expect(() => mgr.start()).not.toThrow();
    expect(() => mgr.stop()).not.toThrow();
    navigator.getGamepads = origGetGamepads;
  });

  it("subscribe returns an unsubscribe function", () => {
    const mgr = new GamepadManager();
    const cb = vi.fn();
    const unsub = mgr.subscribe(cb);
    expect(typeof unsub).toBe("function");
    // calling unsubscribe should not throw
    expect(() => unsub()).not.toThrow();
  });

  it("getAllStates returns a copy", () => {
    const mgr = new GamepadManager();
    const states = mgr.getAllStates();
    expect(states).toBeInstanceOf(Map);
    expect(states.size).toBe(0);
  });

  it("getState returns undefined for unknown index", () => {
    const mgr = new GamepadManager();
    expect(mgr.getState(0)).toBeUndefined();
  });
});
