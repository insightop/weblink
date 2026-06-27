import { describe, it, expect } from "vitest";
import { stringifyClientMessage, parseServerMessage } from "./messageCodec";
import { SIGNALING_VERSION } from "./messageTypes";
import type { ClientToServerMessage, ServerToClientMessage } from "./messageTypes";

describe("stringifyClientMessage", () => {
  it("should serialize a signal message to JSON", () => {
    const msg: ClientToServerMessage = {
      v: SIGNALING_VERSION,
      type: "signal",
      to: "peer-123",
      payload: { kind: "offer", sdp: "sdp-data" },
    };
    const result = stringifyClientMessage(msg);
    expect(JSON.parse(result)).toEqual(msg);
  });

  it("should serialize a ping message", () => {
    const msg: ClientToServerMessage = { v: SIGNALING_VERSION, type: "ping" };
    const result = stringifyClientMessage(msg);
    expect(JSON.parse(result)).toEqual(msg);
  });
});

describe("parseServerMessage", () => {
  it("should parse a valid welcome message", () => {
    const msg: ServerToClientMessage = {
      v: SIGNALING_VERSION,
      type: "welcome",
      peers: ["peer-1"],
      self: "peer-2",
    };
    const result = parseServerMessage(JSON.stringify(msg));
    expect(result).toEqual(msg);
  });

  it("should parse a valid peer-joined message", () => {
    const msg = { v: SIGNALING_VERSION, type: "peer-joined", peerId: "peer-3" };
    expect(parseServerMessage(JSON.stringify(msg))).toEqual(msg);
  });

  it("should parse a valid signal message", () => {
    const msg = {
      v: SIGNALING_VERSION,
      type: "signal",
      from: "peer-1",
      payload: { kind: "answer", sdp: "answer-sdp" },
    };
    expect(parseServerMessage(JSON.stringify(msg))).toEqual(msg);
  });

  it("should return null for invalid JSON", () => {
    expect(parseServerMessage("not-json")).toBeNull();
  });

  it("should return null for wrong version", () => {
    const msg = { v: 99, type: "welcome", peers: [], self: "x" };
    expect(parseServerMessage(JSON.stringify(msg))).toBeNull();
  });

  it("should return null for non-object input", () => {
    expect(parseServerMessage('"string"')).toBeNull();
    expect(parseServerMessage("null")).toBeNull();
    expect(parseServerMessage("42")).toBeNull();
  });
});
