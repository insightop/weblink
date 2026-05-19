import { describe, expect, it } from "vitest";
import { encodeTransmitLine, tryDecodeDataFrameLine } from "./slcan-codec.js";

describe("tryDecodeDataFrameLine", () => {
  it("parses standard rx r", () => {
    const f = tryDecodeDataFrameLine("r1233112233");
    expect(f).not.toBeNull();
    expect(f!.extended).toBe(false);
    expect(f!.id).toBe(0x123);
    expect(f!.dlc).toBe(3);
    expect(f!.direction).toBe("rx");
    expect(Array.from(f!.data)).toEqual([0x11, 0x22, 0x33]);
  });

  it("parses extended rx R", () => {
    const f = tryDecodeDataFrameLine("R0000012321122");
    expect(f).not.toBeNull();
    expect(f!.extended).toBe(true);
    expect(f!.id).toBe(0x123);
    expect(f!.dlc).toBe(2);
    expect(Array.from(f!.data)).toEqual([0x11, 0x22]);
  });

  it("parses tx echo t", () => {
    const f = tryDecodeDataFrameLine("t7ff80011223344556677");
    expect(f).not.toBeNull();
    expect(f!.direction).toBe("tx");
    expect(f!.id).toBe(0x7ff);
    expect(f!.dlc).toBe(8);
  });

  it("returns null for non-data lines", () => {
    expect(tryDecodeDataFrameLine("")).toBeNull();
    expect(tryDecodeDataFrameLine("OK")).toBeNull();
    expect(tryDecodeDataFrameLine("z1233112233")).toBeNull();
  });

  it("throws when DLC mismatches data", () => {
    expect(() => tryDecodeDataFrameLine("r123211")).toThrow();
  });
});

describe("encodeTransmitLine", () => {
  it("standard", () => {
    const line = encodeTransmitLine({
      id: 0x123,
      extended: false,
      dlc: 3,
      data: new Uint8Array([0x11, 0x22, 0x33]),
    });
    expect(line).toBe("t1233112233");
  });

  it("extended", () => {
    const line = encodeTransmitLine({
      id: 0x123,
      extended: true,
      dlc: 2,
      data: new Uint8Array([0xaa, 0xbb]),
    });
    expect(line).toBe("T000001232AABB");
  });
});
