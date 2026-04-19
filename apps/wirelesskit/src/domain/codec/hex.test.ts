import { describe, expect, it } from "vitest";
import { formatHex, parseHex } from "@/domain/codec/hex";

describe("hex", () => {
  it("formatHex formats bytes", () => {
    expect(formatHex(new Uint8Array([0, 1, 10, 255]))).toBe("00 01 0A FF");
  });

  it("parseHex parses with spaces and 0x", () => {
    expect(parseHex("0x00 01 0a ff")).toEqual(new Uint8Array([0, 1, 10, 255]));
  });

  it("parseHex throws on odd length", () => {
    expect(() => parseHex("0")).toThrow(/偶数/);
  });
});

