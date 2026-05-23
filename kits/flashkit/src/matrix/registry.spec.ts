import { describe, expect, it, beforeEach } from "vitest";
import { assertBusSupported, getBridge, initMatrixRegistry } from "./registry";
import { FlashKitError } from "../domain/errors/FlashKitError";
import type { BridgeBackendId } from "./types";

beforeEach(() => {
  initMatrixRegistry();
});

describe("matrix registry", () => {
  it("registers CH341 bridge", () => {
    const b = getBridge("ch341-vendor-bulk");
    expect(b?.id).toBe("ch341-vendor-bulk");
    expect(b?.transport).toBe("webusb");
    if (b?.transport === "webusb") {
      expect(b.supportedBuses).toContain("spi");
      expect(b.supportedBuses).toContain("i2c");
    }
  });

  it("registers FT232H SPI bridge", () => {
    const b = getBridge("ftdi-mpsse-ft232h");
    expect(b?.transport).toBe("webusb");
    if (b?.transport === "webusb") {
      expect(b.supportedBuses).toEqual(["spi"]);
    }
  });

  it("registers CP2112 as webhid", () => {
    const b = getBridge("silabs-cp2112-hid");
    expect(b?.transport).toBe("webhid");
  });

  it("rejects unsupported bus for FT232H", () => {
    expect(() => assertBusSupported("ftdi-mpsse-ft232h", "i2c")).toThrow(FlashKitError);
  });

  it("throws for unknown bridge id", () => {
    expect(() => assertBusSupported("unknown-bridge" as BridgeBackendId, "spi")).toThrow(FlashKitError);
  });
});
