import { describe, expect, it } from "vitest";
import { maxAbs, sampleToWaveformY } from "./waveMath";

describe("maxAbs", () => {
  it("returns floor for zeros", () => {
    const z = new Float32Array([0, 0, 0]);
    expect(maxAbs(z)).toBeCloseTo(1e-9, 12);
  });

  it("finds maximum absolute value", () => {
    const a = new Float32Array([-0.3, 0.5, -0.1]);
    expect(maxAbs(a)).toBeCloseTo(0.5);
  });
});

describe("sampleToWaveformY", () => {
  it("maps zero sample to vertical center", () => {
    const y = sampleToWaveformY(0, 1, 100, 4);
    expect(y).toBe(50);
  });

  it("clamps to peak", () => {
    const h = 100;
    const pad = 4;
    const peak = 0.5;
    const yTop = sampleToWaveformY(peak, peak, h, pad);
    const yBottom = sampleToWaveformY(-peak, peak, h, pad);
    expect(yTop).toBeCloseTo(pad);
    expect(yBottom).toBeCloseTo(h - pad);
  });
});
