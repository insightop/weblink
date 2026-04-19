import { describe, expect, it } from "vitest";
import {
  decodeGsHostFrame,
  encodeGsHostFrameTx,
  buildGsUsbCanId,
} from "./gs-usb-frame-codec.js";
import { GS_HOST_FRAME_SIZE, GS_USB_RX_ECHO_ID } from "./gs-usb-constants.js";

describe("buildGsUsbCanId", () => {
  it("standard 11-bit", () => {
    expect(buildGsUsbCanId(0x123, false)).toBe(0x123);
  });
  it("extended", () => {
    const id = buildGsUsbCanId(0x123, true) >>> 0;
    expect((id & 0x8000_0000) !== 0).toBe(true);
  });
});

describe("decodeGsHostFrame", () => {
  it("rx frame echo -1", () => {
    const buf = new ArrayBuffer(GS_HOST_FRAME_SIZE);
    const v = new DataView(buf);
    v.setUint32(0, GS_USB_RX_ECHO_ID, true);
    v.setUint32(4, 0x123, true);
    v.setUint8(8, 3);
    v.setUint8(9, 0);
    v.setUint8(10, 0);
    v.setUint8(11, 0);
    v.setUint8(12, 0x11);
    v.setUint8(13, 0x22);
    v.setUint8(14, 0x33);
    const f = decodeGsHostFrame(buf);
    expect(f).not.toBeNull();
    expect(f!.direction).toBe("rx");
    expect(f!.id).toBe(0x123);
    expect(f!.dlc).toBe(3);
    expect(Array.from(f!.data)).toEqual([0x11, 0x22, 0x33]);
  });
});

describe("encodeGsHostFrameTx roundtrip-ish", () => {
  it("encodes 20 bytes", () => {
    const ab = encodeGsHostFrameTx({
      id: 0x7ff,
      extended: false,
      dlc: 0,
      data: new Uint8Array(0),
    });
    expect(ab.byteLength).toBe(GS_HOST_FRAME_SIZE);
  });
});
