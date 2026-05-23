import { describe, expect, it } from "vitest";
import {
  buildErasePacket,
  buildIdentifyPacket,
  buildIspEndPacket,
  buildIspKeyPacket,
  buildProgramPacket,
  parseWchIspResponseFrame,
  wchIspRequestChecksum,
} from "../wchUartIspFraming";
import { WCH_ISP_COMMAND } from "../wchUartIspTypes";

describe("wchUartIspFraming", () => {
  it("computes request checksum as 8-bit sum over body only", () => {
    const body = new Uint8Array([0x01, 0x02, 0x03]);
    expect(wchIspRequestChecksum(body)).toBe((1 + 2 + 3) & 0xff);
  });

  it("buildIdentifyPacket matches wchisp layout (cmd + u16 len 0x12 + ids + magic)", () => {
    const p = buildIdentifyPacket(0, 0);
    expect(p[0]).toBe(WCH_ISP_COMMAND.IDENTIFY);
    expect(p[1]).toBe(0x12);
    expect(p[2]).toBe(0);
    expect(p[3]).toBe(0);
    expect(p[4]).toBe(0);
    const magic = new TextDecoder().decode(p.subarray(5));
    expect(magic).toBe("MCU ISP & WCH.CN");
    expect(p.length).toBe(1 + 2 + 1 + 1 + magic.length);
  });

  it("buildErasePacket encodes sector count little-endian", () => {
    const p = buildErasePacket(8);
    expect(p[0]).toBe(WCH_ISP_COMMAND.ERASE);
    expect(p[1]).toBe(0x04);
    expect(p[2]).toBe(0);
    expect([p[3], p[4], p[5], p[6]]).toEqual([8, 0, 0, 0]);
  });

  it("buildIspEndPacket carries reason byte", () => {
    expect(Array.from(buildIspEndPacket(1))).toEqual([WCH_ISP_COMMAND.ISP_END, 0x01, 0x00, 0x01]);
  });

  it("buildIspKeyPacket prefixes length", () => {
    const seed = new Uint8Array([1, 2, 3]);
    const p = buildIspKeyPacket(seed);
    expect(p[0]).toBe(WCH_ISP_COMMAND.ISP_KEY);
    expect(p[1]).toBe(3);
    expect(p[2]).toBe(0);
    expect(Array.from(p.subarray(3))).toEqual([1, 2, 3]);
  });

  it("buildProgramPacket sets size field to total - 3", () => {
    const data = new Uint8Array(4).fill(0xab);
    const p = buildProgramPacket(0x0800_0000, 0x3c, data);
    expect(p[0]).toBe(WCH_ISP_COMMAND.PROGRAM);
    const payloadSize = p[1] | (p[2] << 8);
    expect(payloadSize).toBe(p.length - 3);
    expect(p[7]).toBe(0x3c);
    expect(Array.from(p.subarray(8))).toEqual([0xab, 0xab, 0xab, 0xab]);
  });

  it("parseWchIspResponseFrame extracts payload", () => {
    const payload = new Uint8Array([0x33, 0x14]);
    const raw = new Uint8Array(4 + payload.length);
    raw[0] = WCH_ISP_COMMAND.IDENTIFY;
    raw[1] = 0;
    raw[2] = payload.length & 0xff;
    raw[3] = (payload.length >> 8) & 0xff;
    raw.set(payload, 4);
    const parsed = parseWchIspResponseFrame(raw);
    expect(parsed.command).toBe(WCH_ISP_COMMAND.IDENTIFY);
    expect(Array.from(parsed.payload)).toEqual([0x33, 0x14]);
  });

  it("parseWchIspResponseFrame throws on length mismatch", () => {
    const raw = new Uint8Array([0xa1, 0, 5, 0]);
    expect(() => parseWchIspResponseFrame(raw)).toThrow(/长度/);
  });
});
