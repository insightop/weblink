import { describe, expect, it } from "vitest";
import { rmsFromTimeDomain, rmsToLevel, smoothLevel } from "./levelMath";

describe("rmsFromTimeDomain", () => {
  it("returns 0 for empty", () => {
    expect(rmsFromTimeDomain(new Float32Array(0))).toBe(0);
  });
  it("computes RMS for constant", () => {
    const buf = new Float32Array([0.6, 0.6, 0.6]);
    expect(rmsFromTimeDomain(buf)).toBeCloseTo(0.6, 5);
  });
});

describe("rmsToLevel", () => {
  it("maps silence low", () => {
    expect(rmsToLevel(1e-8)).toBeLessThan(0.1);
  });
});

describe("smoothLevel", () => {
  it("interpolates toward next", () => {
    expect(smoothLevel(0, 1, 0.5)).toBe(0.5);
  });
});
