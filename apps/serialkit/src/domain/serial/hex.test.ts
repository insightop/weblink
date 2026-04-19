import { describe, expect, it } from "vitest";
import { formatHex, parseHex } from "./hex";

describe("parseHex", () => {
  it("parses spaced hex", () => {
    expect(Array.from(parseHex("01 0A ff"))).toEqual([1, 10, 255]);
  });

  it("parses 0x prefix and newlines", () => {
    expect(Array.from(parseHex("0x01\n0x02"))).toEqual([1, 2]);
  });

  it("throws on odd length", () => {
    expect(() => parseHex("A")).toThrow();
  });
});

describe("formatHex", () => {
  it("formats bytes", () => {
    expect(formatHex(new Uint8Array([1, 10, 255]))).toBe("01 0A FF");
  });
});
