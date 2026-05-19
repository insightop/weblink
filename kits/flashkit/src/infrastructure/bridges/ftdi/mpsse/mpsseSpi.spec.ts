import { describe, expect, it } from "vitest";
import { buildMpsseDuplexMsbChunks, buildMpsseSpiInitCommands, buildSetCs, FT232H_DIV_1MHZ } from "./mpsseSpi";

describe("mpsseSpi", () => {
  it("builds init command prefix", () => {
    const b = buildMpsseSpiInitCommands(FT232H_DIV_1MHZ.low, FT232H_DIV_1MHZ.high);
    expect(b[0]).toBe(0x85);
    expect(b[1]).toBe(0x8a);
    expect(b[2]).toBe(0x86);
    expect(b[3]).toBe(5);
    expect(b[4]).toBe(0);
  });

  it("splits duplex into 0x31 chunks", () => {
    const d = new Uint8Array(300);
    d.fill(0xab);
    const m = buildMpsseDuplexMsbChunks(d);
    expect(m[0]).toBe(0x31);
    expect(m[1]).toBe(255);
    expect(m.length).toBe(2 + 256 + 2 + 44);
  });

  it("toggles CS", () => {
    expect(buildSetCs(true)[1]).toBe(0x00);
    expect(buildSetCs(false)[1]).toBe(0x08);
  });
});
