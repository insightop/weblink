import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPeerConnection } from "./peerConnection";

// Mock RTCPeerConnection
function createMockPeerConnection() {
  const listeners: Record<string, Array<(ev: unknown) => void>> = {};
  let onIceCandidateHandler: ((ev: RTCPeerConnectionIceEvent) => void) | null = null;
  let onTrackHandler: ((ev: RTCTrackEvent) => void) | null = null;

  const pc = {
    localDescription: null as RTCSessionDescription | null,
    remoteDescription: null as RTCSessionDescription | null,
    connectionState: "new" as RTCPeerConnectionState,

    addEventListener: vi.fn((type: string, handler: (ev: unknown) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    }),

    setLocalDescription: vi.fn(async (desc: RTCSessionDescriptionInit) => {
      pc.localDescription = desc as RTCSessionDescription;
    }),
    setRemoteDescription: vi.fn(async (desc: RTCSessionDescriptionInit) => {
      pc.remoteDescription = desc as RTCSessionDescription;
    }),
    createOffer: vi.fn(async () => ({ type: "offer" as const, sdp: "mock-offer-sdp" })),
    createAnswer: vi.fn(async () => ({ type: "answer" as const, sdp: "mock-answer-sdp" })),
    addIceCandidate: vi.fn(async (_candidate: RTCIceCandidateInit) => {}),
    addTrack: vi.fn((_track: MediaStreamTrack, _stream: MediaStream) => ({} as RTCRtpSender)),
    removeTrack: vi.fn((_sender: RTCRtpSender) => {}),
    close: vi.fn(),

    get onicecandidate() {
      return onIceCandidateHandler;
    },
    set onicecandidate(handler: ((ev: RTCPeerConnectionIceEvent) => void) | null) {
      onIceCandidateHandler = handler;
    },
    get ontrack() {
      return onTrackHandler;
    },
    set ontrack(handler: ((ev: RTCTrackEvent) => void) | null) {
      onTrackHandler = handler;
    },

    // Test helpers
    emitIceCandidate(candidate: RTCIceCandidate | null) {
      onIceCandidateHandler?.({ candidate } as RTCPeerConnectionIceEvent);
    },
    emitTrack(track: MediaStreamTrack, streams: MediaStream[]) {
      onTrackHandler?.({ track, streams } as unknown as RTCTrackEvent);
    },
    setConnectionState(state: RTCPeerConnectionState) {
      pc.connectionState = state;
      for (const handler of listeners["connectionstatechange"] ?? []) {
        handler({});
      }
    },
  };

  return pc;
}

describe("createPeerConnection", () => {
  let mockPc: ReturnType<typeof createMockPeerConnection>;

  beforeEach(() => {
    mockPc = createMockPeerConnection();
    // Use a class as mock so `new RTCPeerConnection()` works
    class MockRTCPeerConnection {
      constructor() {
        return mockPc;
      }
    }
    vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should create an offer with SDP", async () => {
    const manager = createPeerConnection({ iceServers: [] });
    const offer = await manager.createOffer();

    expect(offer).toEqual({ type: "offer", sdp: "mock-offer-sdp" });
    expect(mockPc.createOffer).toHaveBeenCalled();
    expect(mockPc.setLocalDescription).toHaveBeenCalled();
  });

  it("should handle an offer and return an answer", async () => {
    const manager = createPeerConnection({ iceServers: [] });
    const answer = await manager.handleOffer({ type: "offer", sdp: "remote-offer-sdp" });

    expect(answer).toEqual({ type: "answer", sdp: "mock-answer-sdp" });
    expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({
      type: "offer",
      sdp: "remote-offer-sdp",
    });
    expect(mockPc.createAnswer).toHaveBeenCalled();
    expect(mockPc.setLocalDescription).toHaveBeenCalled();
  });

  it("should handle an answer", async () => {
    const manager = createPeerConnection({ iceServers: [] });
    await manager.handleAnswer({ type: "answer", sdp: "remote-answer-sdp" });

    expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "remote-answer-sdp",
    });
  });

  it("should add ICE candidates", async () => {
    const manager = createPeerConnection({ iceServers: [] });
    const candidate = { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 };
    await manager.addIceCandidate(candidate);

    expect(mockPc.addIceCandidate).toHaveBeenCalledWith(candidate);
  });

  it("should invoke onIceCandidate callback", () => {
    const candidateHandler = vi.fn();
    const manager = createPeerConnection({ iceServers: [] });
    manager.onIceCandidate = candidateHandler;

    const mockCandidate = { candidate: "test" } as unknown as RTCIceCandidate;
    mockPc.emitIceCandidate(mockCandidate);

    expect(candidateHandler).toHaveBeenCalledWith(mockCandidate);
  });

  it("should invoke onTrack callback", () => {
    const trackHandler = vi.fn();
    const manager = createPeerConnection({ iceServers: [] });
    manager.onTrack = trackHandler;

    const track = { kind: "video" } as unknown as MediaStreamTrack;
    const stream = {} as MediaStream;
    mockPc.emitTrack(track, [stream]);

    expect(trackHandler).toHaveBeenCalledWith(track, stream);
  });

  it("should invoke onConnectionStateChange callback", () => {
    const stateHandler = vi.fn();
    const manager = createPeerConnection({ iceServers: [] });
    manager.onConnectionStateChange = stateHandler;

    mockPc.setConnectionState("connected");

    expect(stateHandler).toHaveBeenCalledWith("connected");
  });

  it("should add and remove tracks", () => {
    const manager = createPeerConnection({ iceServers: [] });
    const track = {} as MediaStreamTrack;
    const stream = {} as MediaStream;

    manager.addTrack(track, stream);
    expect(mockPc.addTrack).toHaveBeenCalledWith(track, stream);

    const sender = {} as RTCRtpSender;
    manager.removeTrack(sender);
    expect(mockPc.removeTrack).toHaveBeenCalledWith(sender);
  });

  it("should close the connection", () => {
    const manager = createPeerConnection({ iceServers: [] });
    manager.close();
    expect(mockPc.close).toHaveBeenCalled();
  });
});
