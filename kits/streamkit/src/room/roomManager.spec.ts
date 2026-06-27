import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoom, joinRoom, generateShareCode } from "./roomManager";
import { SIGNALING_VERSION } from "../signaling/messageTypes";
import type { SignalingTransport } from "../signaling/signalingTransport";
import type { ServerToClientMessage } from "../signaling/messageTypes";

vi.mock("../signaling/signalingClient", () => ({
  createSignalingClient: vi.fn(),
}));

vi.mock("../webrtc/peerConnection", () => ({
  createPeerConnection: vi.fn(),
}));

import { createSignalingClient } from "../signaling/signalingClient";
import { createPeerConnection } from "../webrtc/peerConnection";

function createMockSignaling() {
  let msgHandler: ((msg: unknown) => void) | null = null;
  let closeHandler: ((code: number, reason: string) => void) | null = null;

  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    send: vi.fn(),
    onMessage: vi.fn((handler: (msg: ServerToClientMessage) => void) => {
      msgHandler = handler as (msg: unknown) => void;
    }),
    onClose: vi.fn((handler: (code: number, reason: string) => void) => {
      closeHandler = handler;
    }),
    onError: vi.fn(),
    connected: true,
    _triggerMessage(msg: unknown) {
      if (msgHandler) msgHandler(msg as never);
    },
    _triggerClose(code: number, reason: string) {
      if (closeHandler) closeHandler(code, reason);
    },
  };
}

function createMockPeerConnection() {
  let trackHandler: ((track: MediaStreamTrack, stream: MediaStream) => void) | null = null;
  let iceHandler: ((candidate: RTCIceCandidate) => void) | null = null;
  let stateHandler: ((state: RTCPeerConnectionState) => void) | null = null;

  return {
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "mock-sdp" })),
    handleOffer: vi.fn(async () => ({ type: "answer", sdp: "mock-answer" })),
    handleAnswer: vi.fn(async () => {}),
    addIceCandidate: vi.fn(async () => {}),
    addTrack: vi.fn(() => ({}) as RTCRtpSender),
    removeTrack: vi.fn(),
    setEncodingStrategy: vi.fn(async () => {}),
    requestMic: vi.fn(),
    requestCamera: vi.fn(),
    close: vi.fn(),
    get onTrack() { return trackHandler; },
    set onTrack(h) { trackHandler = h; },
    get onIceCandidate() { return iceHandler; },
    set onIceCandidate(h) { iceHandler = h; },
    get onConnectionStateChange() { return stateHandler; },
    set onConnectionStateChange(h) { stateHandler = h; },
    onNegotiationNeeded: null as (() => Promise<void>) | null,
    _triggerTrack(track: MediaStreamTrack, stream: MediaStream) { trackHandler?.(track, stream); },
    _triggerIce(candidate: RTCIceCandidate) { iceHandler?.(candidate); },
    _triggerState(state: RTCPeerConnectionState) { stateHandler?.(state); },
  };
}

describe("generateShareCode", () => {
  it("should generate 8-digit numeric code", () => {
    const code = generateShareCode();
    expect(code).toMatch(/^\d{8}$/);
  });
});

describe("createRoom (demo side)", () => {
  let mockSignaling: ReturnType<typeof createMockSignaling>;
  let mockPc: ReturnType<typeof createMockPeerConnection>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSignaling = createMockSignaling();
    mockPc = createMockPeerConnection();
    vi.mocked(createSignalingClient).mockReturnValue(mockSignaling as unknown as SignalingTransport);
    vi.mocked(createPeerConnection).mockReturnValue(mockPc as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should connect to signaling server and generate share code", async () => {
    const sessionPromise = createRoom({
      signalingUrl: "wss://example.com",
    });

    mockSignaling._triggerMessage({
      v: SIGNALING_VERSION,
      type: "welcome",
      peers: [],
      self: "demo-1234",
    });

    const session = await sessionPromise;
    expect(session.roomId).toMatch(/^\d{8}$/);
    expect(session.peerId).toBe("demo-1234");
    expect(mockSignaling.connect).toHaveBeenCalled();
  });

  it("should transition to connected when peer joins and WebRTC connects", async () => {
    const sessionPromise = createRoom({ signalingUrl: "wss://example.com" });

    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: [], self: "demo-1234" });
    const session = await sessionPromise;

    const stateChanges: string[] = [];
    session.on("state-change", (s) => stateChanges.push(s));

    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "peer-joined", peerId: "admin-xyz" });
    await vi.runAllTimersAsync();

    expect(mockPc.createOffer).toHaveBeenCalled();

    mockSignaling._triggerMessage({
      v: SIGNALING_VERSION, type: "signal", from: "admin-xyz",
      payload: { kind: "answer", sdp: "remote-answer" },
    });

    expect(mockPc.handleAnswer).toHaveBeenCalled();
    mockPc._triggerState("connected");
    expect(stateChanges).toContain("connected");
  });

  it("should forward ICE candidates to signaling", async () => {
    const sessionPromise = createRoom({ signalingUrl: "wss://example.com" });
    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: [], self: "demo-1234" });
    await sessionPromise;

    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "peer-joined", peerId: "admin-xyz" });
    await vi.runAllTimersAsync();

    const candidate = { candidate: "ice-1", toJSON: () => ({ candidate: "ice-1" }) };
    mockPc._triggerIce(candidate as unknown as RTCIceCandidate);

    expect(mockSignaling.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signal", to: "admin-xyz", payload: expect.objectContaining({ kind: "candidate" }) }),
    );
  });

  it("should handle remote ICE candidates", async () => {
    const sessionPromise = createRoom({ signalingUrl: "wss://example.com" });
    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: [], self: "demo-1234" });
    await sessionPromise;

    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "peer-joined", peerId: "admin-xyz" });

    mockSignaling._triggerMessage({
      v: SIGNALING_VERSION, type: "signal", from: "admin-xyz",
      payload: { kind: "candidate", ice: { candidate: "c1", sdpMid: "0", sdpMLineIndex: 0 } },
    });

    expect(mockPc.addIceCandidate).toHaveBeenCalled();
  });

  it("should clean up on dispose", async () => {
    const sessionPromise = createRoom({ signalingUrl: "wss://example.com" });
    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: [], self: "demo-1234" });
    const session = await sessionPromise;
    session.dispose();
    expect(mockSignaling.disconnect).toHaveBeenCalled();
  });
});

describe("joinRoom (admin side)", () => {
  let mockSignaling: ReturnType<typeof createMockSignaling>;
  let mockPc: ReturnType<typeof createMockPeerConnection>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSignaling = createMockSignaling();
    mockPc = createMockPeerConnection();
    vi.mocked(createSignalingClient).mockReturnValue(mockSignaling as unknown as SignalingTransport);
    vi.mocked(createPeerConnection).mockReturnValue(mockPc as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should connect to signaling by share code and wait for offer", async () => {
    const sessionPromise = joinRoom({
      signalingUrl: "wss://example.com",
      roomId: "12345678",
    });

    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: ["demo-1234"], self: "admin-xyz" });

    const session = await sessionPromise;
    expect(session.roomId).toBe("12345678");
    expect(session.peerId).toBe("admin-xyz");
  });

  it("should reject without roomId", async () => {
    await expect(joinRoom({ signalingUrl: "wss://example.com" as string, roomId: "" as string })).rejects.toThrow();
  });

  it("should handle offer and send answer", async () => {
    const sessionPromise = joinRoom({ signalingUrl: "wss://example.com", roomId: "12345678" });
    mockSignaling._triggerMessage({ v: SIGNALING_VERSION, type: "welcome", peers: ["demo-1234"], self: "admin-xyz" });
    await sessionPromise;

    mockSignaling._triggerMessage({
      v: SIGNALING_VERSION, type: "signal", from: "demo-1234",
      payload: { kind: "offer", sdp: "remote-offer" },
    });
    await vi.runAllTimersAsync();

    expect(mockPc.handleOffer).toHaveBeenCalled();
    expect(mockSignaling.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signal", to: "demo-1234", payload: expect.objectContaining({ kind: "answer" }) }),
    );
  });
});
