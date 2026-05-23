import { describe, expect, it } from "vitest";
import { buildCh341aSpiTransaction, buildPluckCs } from "./ch341SpiPackets";

describe("ch341SpiPackets", () => {
  it("builds pluck_cs with default delay", () => {
    const p = buildPluckCs(2);
    expect(p.length).toBeGreaterThan(0);
    expect(p[0]).toBe(0xab); // UIO stream
  });

  it("matches flashrom total OUT length for W=4 R=0", () => {
    const w = new Uint8Array([0x9f, 0, 0, 0]);
    const { out, expectedInTotal } = buildCh341aSpiTransaction(w, 0);
    expect(expectedInTotal).toBe(4);
    expect(out.length).toBe(32 + 1 + 4 + 0);
  });

  it("matches flashrom total OUT length for W=0 R=4", () => {
    const w = new Uint8Array(0);
    const { out, expectedInTotal } = buildCh341aSpiTransaction(w, 4);
    expect(expectedInTotal).toBe(4);
    expect(out.length).toBe(32 + 1 + 0 + 4);
  });
});
