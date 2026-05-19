import { describe, expect, it } from "vitest";
import {
  encodeCp2112ReadRequest,
  encodeCp2112WriteReadRequest,
  encodeCp2112WriteRequest,
} from "./cp2112Reports";

describe("cp2112Reports", () => {
  it("encodes read request", () => {
    const b = encodeCp2112ReadRequest(0x50, 128);
    expect(b[0]).toBe(0xa0);
    expect(b[1]).toBe(0);
    expect(b[2]).toBe(128);
  });

  it("encodes write-read", () => {
    const b = encodeCp2112WriteReadRequest(0x50, new Uint8Array([0x12, 0x34]), 64);
    expect(b[0]).toBe(0xa0);
    expect(b[3]).toBe(2);
    expect(b[4]).toBe(0x12);
    expect(b[5]).toBe(0x34);
  });

  it("encodes write", () => {
    const b = encodeCp2112WriteRequest(0x50, new Uint8Array([0xab]));
    expect(b[0]).toBe(0xa0);
    expect(b[1]).toBe(1);
    expect(b[2]).toBe(0xab);
  });
});
