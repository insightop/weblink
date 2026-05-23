import { describe, expect, it } from "vitest";
import { parseServerMessage } from "./messageCodec";
import { SIGNALING_VERSION } from "./messageTypes";

describe("parseServerMessage", () => {
  it("parses welcome", () => {
    const raw = JSON.stringify({
      v: SIGNALING_VERSION,
      type: "welcome",
      peers: ["a", "b"],
      self: "c",
    });
    const m = parseServerMessage(raw);
    expect(m).toEqual({
      v: SIGNALING_VERSION,
      type: "welcome",
      peers: ["a", "b"],
      self: "c",
    });
  });

  it("parses signal offer", () => {
    const raw = JSON.stringify({
      v: SIGNALING_VERSION,
      type: "signal",
      from: "peer1",
      payload: { kind: "offer", sdp: "v=0\r\n" },
    });
    const m = parseServerMessage(raw);
    expect(m).toEqual({
      v: SIGNALING_VERSION,
      type: "signal",
      from: "peer1",
      payload: { kind: "offer", sdp: "v=0\r\n" },
    });
  });

  it("rejects wrong version", () => {
    expect(parseServerMessage(JSON.stringify({ v: 99, type: "welcome", peers: [], self: "x" }))).toBe(
      null,
    );
  });
});
