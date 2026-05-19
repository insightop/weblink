import { describe, expect, it } from "vitest";
import { parseIntelHex } from "@/shared/firmware/hex";

describe("parseIntelHex", () => {
  it("parses contiguous records and returns base address", () => {
    const hex = [
      ":020000040800F2",
      ":10000000000102030405060708090A0B0C0D0E0F78",
      ":00000001FF",
    ].join("\n");
    const result = parseIntelHex(hex);
    expect(result.baseAddr).toBe(0x08000000);
    expect(result.bytes.length).toBe(16);
    expect(result.bytes[0]).toBe(0x00);
    expect(result.bytes[15]).toBe(0x0f);
  });

  it("fills holes with 0xFF", () => {
    const hex = [
      ":020000040800F2",
      ":020000000A0BE9",
      ":020004000C0DE1",
      ":00000001FF",
    ].join("\n");
    const result = parseIntelHex(hex);
    expect(result.baseAddr).toBe(0x08000000);
    expect(Array.from(result.bytes)).toEqual([0x0a, 0x0b, 0xff, 0xff, 0x0c, 0x0d]);
  });

  it("throws for empty payload", () => {
    expect(() => parseIntelHex(":00000001FF")).toThrow(/no data/i);
  });
});
