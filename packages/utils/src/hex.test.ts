import { describe, expect, it } from "vitest";
import { formatHex, parseHex, parseHexBytes, formatHexId, formatDataHex } from "./hex";

describe("formatHex", () => {
  it("formats bytes with space separator", () => {
    expect(formatHex(new Uint8Array([0x0a, 0xff, 0x00]))).toBe("0A FF 00");
  });

  it("formats empty array", () => {
    expect(formatHex(new Uint8Array([]))).toBe("");
  });

  it("formats with grouping", () => {
    expect(formatHex(new Uint8Array([0x01, 0x02, 0x03, 0x04]), 2)).toBe("0102 0304");
  });
});

describe("parseHex", () => {
  it("parses hex string", () => {
    const result = parseHex("0AFF00");
    expect(result).toEqual(new Uint8Array([0x0a, 0xff, 0x00]));
  });

  it("parses hex with 0x prefix", () => {
    expect(parseHex("0x0AFF")).toEqual(new Uint8Array([0x0a, 0xff]));
  });

  it("parses hex with spaces and separators", () => {
    expect(parseHex("0A FF,00")).toEqual(new Uint8Array([0x0a, 0xff, 0x00]));
  });

  it("returns empty array for empty input", () => {
    expect(parseHex("")).toEqual(new Uint8Array());
  });

  it("throws on invalid characters", () => {
    expect(() => parseHex("0GH")).toThrow();
  });

  it("throws on odd length", () => {
    expect(() => parseHex("0AF")).toThrow();
  });
});

describe("parseHexBytes", () => {
  it("parses hex string with spaces", () => {
    expect(parseHexBytes("0A FF 00")).toEqual(new Uint8Array([0x0a, 0xff, 0x00]));
  });

  it("throws on odd length", () => {
    expect(() => parseHexBytes("0AF")).toThrow();
  });
});

describe("formatHexId", () => {
  it("formats 11-bit CAN ID", () => {
    expect(formatHexId(0x7df, false)).toBe("0x7DF");
  });

  it("formats 29-bit extended CAN ID", () => {
    expect(formatHexId(0x18db33f1, true)).toBe("0x18DB33F1");
  });
});

describe("formatDataHex", () => {
  it("formats data bytes", () => {
    expect(formatDataHex(new Uint8Array([0x02, 0x01, 0x00]))).toBe("02 01 00");
  });
});
