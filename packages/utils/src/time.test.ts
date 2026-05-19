import { describe, expect, it } from "vitest";
import { formatTime, formatTimeMs } from "./time";

describe("formatTime", () => {
  it("formats timestamp to locale time string", () => {
    const ts = new Date(2024, 0, 15, 14, 30, 45).getTime();
    const result = formatTime(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });
});

describe("formatTimeMs", () => {
  it("formats timestamp with milliseconds", () => {
    const ts = new Date(2024, 0, 15, 14, 30, 45, 123).getTime();
    expect(formatTimeMs(ts)).toBe("14:30:45.123");
  });

  it("pads single digits", () => {
    const ts = new Date(2024, 0, 15, 1, 2, 3, 4).getTime();
    expect(formatTimeMs(ts)).toBe("01:02:03.004");
  });
});
