import { describe, expect, it } from "vitest";
import { PluginRegistry } from "./registry";
import type { FlasherPlugin } from "./types";

const pluginA: FlasherPlugin = {
  id: "a",
  displayName: "A",
  chipFamily: "stm32",
  flasherType: "serial",
  canSelectConnection: true,
  canFlash: true,
  priority: 10,
  supportedInputs: ["single-bin"],
  firmwareInputPolicy: {
    minRows: 1,
    maxRows: 1,
    defaultRows: 1,
    addressUserEditable: false,
    showAddressColumn: true,
    hexFilePolicy: "allow",
    defaultAppAddress: 0x0800_0000,
  },
  featureFlags: [],
  supports: ({ chipFamily, flasherType }) => chipFamily === "stm32" && flasherType === "serial",
  createTransport: () => ({ name: "mock", open: async () => {}, close: async () => {}, write: async () => {}, read: async () => new Uint8Array(0) }),
  createProtocol: () => ({
    probe: async () => ({ chipFamily: "stm32", chipName: "mock" }),
    sync: async () => {},
    buildPlan: async () => ({ chipFamily: "stm32", segments: [] }),
    erase: async () => {},
    write: async () => {},
  }),
};

describe("PluginRegistry", () => {
  it("resolves plugin by criteria", () => {
    const registry = new PluginRegistry();
    registry.register(pluginA);
    const resolved = registry.resolve({
      chipFamily: "stm32",
      flasherType: "serial",
      capabilities: { webSerial: true, webUsb: true, webHid: true },
    });
    expect(resolved.id).toBe("a");
  });

  it("throws when no match", () => {
    const registry = new PluginRegistry();
    expect(() =>
      registry.resolve({
        chipFamily: "esp32",
        flasherType: "serial",
        capabilities: { webSerial: true, webUsb: true, webHid: true },
      }),
    ).toThrow(/No plugin matched/);
  });

  it("returns null when no match via tryResolve", () => {
    const registry = new PluginRegistry();
    const resolved = registry.tryResolve({
      chipFamily: "esp32",
      flasherType: "serial",
      capabilities: { webSerial: true, webUsb: true, webHid: true },
    });
    expect(resolved).toBeNull();
  });

  it("returns null when capability gate fails", () => {
    const registry = new PluginRegistry();
    registry.register({
      ...pluginA,
      supports: ({ capabilities }) => capabilities.webSerial,
    });
    const resolved = registry.tryResolve({
      chipFamily: "stm32",
      flasherType: "serial",
      capabilities: { webSerial: false, webUsb: true, webHid: true },
    });
    expect(resolved).toBeNull();
  });

  it("resolves gd32 plugin when criteria matches", () => {
    const registry = new PluginRegistry();
    registry.register({
      ...pluginA,
      id: "gd32-serial",
      chipFamily: "gd32",
      supports: ({ chipFamily, flasherType, capabilities }) =>
        chipFamily === "gd32" && flasherType === "serial" && capabilities.webSerial,
    });
    const resolved = registry.resolve({
      chipFamily: "gd32",
      flasherType: "serial",
      capabilities: { webSerial: true, webUsb: true, webHid: true },
    });
    expect(resolved.id).toBe("gd32-serial");
  });
});
