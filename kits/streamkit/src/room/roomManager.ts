import { createSignalingClient } from "../signaling/signalingClient";
import { createPeerConnection } from "../webrtc/peerConnection";
import { ICE_CONFIG } from "../webrtc/iceConfig";
import type { SignalingTransport } from "../signaling/signalingTransport";
import type { PeerConnectionManager } from "../webrtc/peerConnection";
import type { ServerToClientMessage, SignalPayload } from "../signaling/messageTypes";
import { SIGNALING_VERSION } from "../signaling/messageTypes";
import type { Session, SessionEventMap, SessionOptions, SessionState } from "./roomTypes";

type EventHandler<K extends keyof SessionEventMap> = SessionEventMap[K];

/**
 * 生成 8 位十进制分享码
 */
export function generateShareCode(): string {
  const code = Math.floor(Math.random() * 100000000);
  return code.toString().padStart(8, "0");
}

/**
 * 创建房间（远端/demo 侧）。
 * 生成 8 位分享码，等待运维端加入后发起 WebRTC 连接。
 */
export async function createRoom(options: SessionOptions): Promise<Session> {
  const roomId = generateShareCode();
  const peerId = `demo-${generateShareCode().slice(0, 4)}`;
  const iceConfig = options.iceServers ? { iceServers: options.iceServers } : ICE_CONFIG;

  const signaling = createSignalingClient();
  const eventHandlers = createEventHandlerMap();
  let state: SessionState = "connecting";
  const remoteStreams = new Map<string, MediaStream>();
  let pc: PeerConnectionManager | null = null;
  let currentPeer: string | null = null;
  const cameraRef = { current: null as MediaStream | null };

  const url = buildSignalingUrl(options.signalingUrl, roomId, peerId);
  const welcomePromise = waitForWelcome(signaling);
  signaling.connect(url);
  const welcomeMsg = await welcomePromise;
  const actualPeerId = welcomeMsg.self;

  signaling.onMessage((msg) => {
    handleSignalingMessage(msg, {
      signaling,
      peerId: actualPeerId,
      iceConfig,
      eventHandlers,
      remoteStreams,
      cameraRef,
      getPeerConnection: () => pc,
      setPeerConnection: (newPc, newPeer) => {
        pc = newPc;
        currentPeer = newPeer;
      },
      getPeerId: () => currentPeer,
      setState: (s) => {
        state = s;
        eventHandlers.get("state-change")?.forEach((h) => h(s));
      },
      get isOfferer() {
        return true;
      },
    }).catch((err) => {
      console.error("[streamkit] handleSignalingMessage error:", err);
    });
  });

  return buildSession({ roomId, peerId: actualPeerId, state, remoteStreams, cameraRef, signaling, eventHandlers, getPc: () => pc, setPc: (p) => { pc = p; }, getPeerId: () => currentPeer, setState: (s) => { state = s; } });
}

/**
 * 加入房间（运维端/admin 侧）。
 * 通过 8 位分享码加入，接收远端媒体流。
 */
export async function joinRoom(options: SessionOptions): Promise<Session> {
  if (!options.roomId) throw new Error("roomId (share code) is required to join a room");

  const roomId = options.roomId;
  const peerId = `admin-${generateShareCode().slice(0, 4)}`;
  const iceConfig = options.iceServers ? { iceServers: options.iceServers } : ICE_CONFIG;

  const signaling = createSignalingClient();
  const eventHandlers = createEventHandlerMap();
  let state: SessionState = "connecting";
  const remoteStreams = new Map<string, MediaStream>();
  let pc: PeerConnectionManager | null = null;
  let currentPeer: string | null = null;
  const cameraRef = { current: null as MediaStream | null };

  const url = buildSignalingUrl(options.signalingUrl, roomId, peerId);
  const welcomePromise = waitForWelcome(signaling);
  signaling.connect(url);
  const welcomeMsg = await welcomePromise;
  const actualPeerId = welcomeMsg.self;

  signaling.onMessage((msg) => {
    handleSignalingMessage(msg, {
      signaling,
      peerId: actualPeerId,
      iceConfig,
      eventHandlers,
      remoteStreams,
      cameraRef,
      getPeerConnection: () => pc,
      setPeerConnection: (newPc, newPeer) => {
        pc = newPc;
        currentPeer = newPeer;
      },
      getPeerId: () => currentPeer,
      setState: (s) => {
        state = s;
        eventHandlers.get("state-change")?.forEach((h) => h(s));
      },
      get isOfferer() {
        return false;
      },
    }).catch((err) => {
      console.error("[streamkit] handleSignalingMessage error:", err);
    });
  });

  return buildSession({ roomId, peerId: actualPeerId, state, remoteStreams, cameraRef, signaling, eventHandlers, getPc: () => pc, setPc: (p) => { pc = p; }, getPeerId: () => currentPeer, setState: (s) => { state = s; } });
}

// ── Internal helpers ──────────────────────────────────────────────

interface BuildSessionArgs {
  roomId: string;
  peerId: string;
  state: SessionState;
  remoteStreams: Map<string, MediaStream>;
  cameraRef: { current: MediaStream | null };
  signaling: SignalingTransport;
  eventHandlers: Map<string, AnyEventHandler[]>;
  getPc: () => PeerConnectionManager | null;
  setPc: (pc: PeerConnectionManager | null) => void;
  getPeerId: () => string | null;
  setState: (s: SessionState) => void;
}

function buildSession(args: BuildSessionArgs): Session {
  const { roomId, peerId, remoteStreams, signaling, eventHandlers, getPeerId, cameraRef } = args;
  let { state, getPc, setPc } = args;

  return {
    get roomId() { return roomId; },
    get peerId() { return peerId; },
    get state() { return state; },
    get remoteStreams() { return remoteStreams; },
    get cameraStream() { return cameraRef.current; },
    on<K extends keyof SessionEventMap>(event: K, handler: EventHandler<K>) {
      const h = eventHandlers.get(event) ?? [];
      h.push(handler as never);
      eventHandlers.set(event, h);
    },
    off<K extends keyof SessionEventMap>(event: K, handler: EventHandler<K>) {
      const h = eventHandlers.get(event) ?? [];
      eventHandlers.set(event, h.filter((x) => x !== handler) as never[]);
    },
    addTrack(track, stream) {
      if (!getPc()) {
        const pc = createPeerConnection(ICE_CONFIG);
        setPc(pc);
        setupPeerConnection(pc, signaling, "", eventHandlers, remoteStreams, cameraRef, (s) => { state = s; });
      }
      return getPc()!.addTrack(track, stream);
    },
    removeTrack(sender) {
      getPc()?.removeTrack(sender);
    },
    async setEncodingStrategy(strategy) {
      const pc = getPc();
      if (pc) await pc.setEncodingStrategy(strategy);
      const peer = getPeerId();
      if (peer) {
        signaling.send({
          v: SIGNALING_VERSION,
          type: "signal",
          to: peer,
          payload: { kind: "encoding-strategy", strategy },
        });
      }
    },
    requestMic() {
      const peer = getPeerId();
      if (peer) signaling.send({ v: SIGNALING_VERSION, type: "signal", to: peer, payload: { kind: "request-mic" } });
    },
    requestCamera() {
      const peer = getPeerId();
      if (peer) signaling.send({ v: SIGNALING_VERSION, type: "signal", to: peer, payload: { kind: "request-camera" } });
    },
    dispose() {
      getPc()?.close();
      setPc(null);
      signaling.disconnect();
      state = "disconnected";
      eventHandlers.get("state-change")?.forEach((h) => h("disconnected"));
    },
  };
}

interface SessionContext {
  signaling: SignalingTransport;
  peerId: string;
  iceConfig: RTCConfiguration;
  eventHandlers: Map<string, AnyEventHandler[]>;
  remoteStreams: Map<string, MediaStream>;
  cameraRef: { current: MediaStream | null };
  getPeerConnection: () => PeerConnectionManager | null;
  setPeerConnection: (pc: PeerConnectionManager, peerId: string) => void;
  getPeerId: () => string | null;
  setState: (state: SessionState) => void;
  readonly isOfferer: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (...args: any[]) => void;

function createEventHandlerMap() {
  return new Map<string, AnyEventHandler[]>();
}

function buildSignalingUrl(baseUrl: string, roomId: string, peerId: string): string {
  const url = new URL(`/api/room/${roomId}/signaling`, baseUrl);
  url.searchParams.set("peerId", peerId);
  return url.toString();
}

function waitForWelcome(signaling: SignalingTransport): Promise<{ self: string; peers: string[] }> {
  return new Promise((resolve) => {
    signaling.onMessage(function onFirst(msg) {
      if (msg.type === "welcome") {
        signaling.onMessage(() => {});
        resolve({ self: msg.self, peers: msg.peers });
      }
    });
  });
}

function setupPeerConnection(
  pc: PeerConnectionManager,
  signaling: SignalingTransport,
  remotePeer: string,
  eventHandlers: Map<string, AnyEventHandler[]>,
  remoteStreams: Map<string, MediaStream>,
  cameraRef: { current: MediaStream | null },
  setState: (s: SessionState) => void,
) {
  pc.onIceCandidate = (candidate) => {
    signaling.send({
      v: SIGNALING_VERSION,
      type: "signal",
      to: remotePeer,
      payload: {
        kind: "candidate",
        ice: { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex },
      },
    });
  };

  pc.onTrack = (track, stream) => {
    const existing = remoteStreams.get(remotePeer);
    if (existing && existing.id !== stream.id) {
      // Second stream for the same peer — treat as camera
      cameraRef.current = stream;
      eventHandlers.get("camera-stream")?.forEach((h) => h(stream));
    } else {
      remoteStreams.set(remotePeer, stream);
      eventHandlers.get("remote-stream")?.forEach((h) => h(remotePeer, stream));
    }
    stream.onremovetrack = () => {
      if (stream.getTracks().length === 0) {
        if (cameraRef.current === stream) {
          cameraRef.current = null;
          eventHandlers.get("camera-stream")?.forEach((h) => h(null));
        } else if (remoteStreams.get(remotePeer) === stream) {
          remoteStreams.delete(remotePeer);
          eventHandlers.get("remote-track-removed")?.forEach((h) => h(remotePeer, track));
        }
      }
    };
  };

  pc.onConnectionStateChange = (connState) => {
    if (connState === "connected") setState("connected");
    else if (connState === "failed" || connState === "disconnected") setState("disconnected");
  };

  pc.onNegotiationNeeded = async () => {
    if (!remotePeer) return; // 还没有远端对等端加入，等待 peer-joined
    const offer = await pc.createOffer();
    signaling.send({
      v: SIGNALING_VERSION,
      type: "signal",
      to: remotePeer,
      payload: { kind: "offer", sdp: offer.sdp! },
    });
  };
}

async function handleSignalingMessage(msg: ServerToClientMessage, ctx: SessionContext): Promise<void> {
  switch (msg.type) {
    case "peer-joined": {
      ctx.eventHandlers.get("peer-joined")?.forEach((h) => h(msg.peerId));
      if (ctx.isOfferer) {
        const pc = ctx.getPeerConnection() ?? createPeerConnection(ctx.iceConfig);
        ctx.setPeerConnection(pc, msg.peerId);
        setupPeerConnection(pc, ctx.signaling, msg.peerId, ctx.eventHandlers, ctx.remoteStreams, ctx.cameraRef, ctx.setState);
        const offer = await pc.createOffer();
        ctx.signaling.send({
          v: SIGNALING_VERSION,
          type: "signal",
          to: msg.peerId,
          payload: { kind: "offer", sdp: offer.sdp! },
        });
      }
      break;
    }
    case "peer-left": {
      ctx.eventHandlers.get("peer-left")?.forEach((h) => h(msg.peerId));
      ctx.remoteStreams.delete(msg.peerId);
      if (ctx.cameraRef.current) {
        ctx.cameraRef.current = null;
        ctx.eventHandlers.get("camera-stream")?.forEach((h) => h(null));
      }
      // 断开连接并切到已断开状态
      const peerPc = ctx.getPeerConnection();
      if (peerPc) peerPc.close();
      ctx.setState("disconnected");
      break;
    }
    case "signal": {
      const pc = ctx.getPeerConnection();
      if (!pc) {
        if (msg.payload.kind === "offer") {
          const newPc = createPeerConnection(ctx.iceConfig);
          ctx.setPeerConnection(newPc, msg.from);
          setupPeerConnection(newPc, ctx.signaling, msg.from, ctx.eventHandlers, ctx.remoteStreams, ctx.cameraRef, ctx.setState);
          const answer = await newPc.handleOffer({ type: "offer", sdp: msg.payload.sdp });
          ctx.signaling.send({
            v: SIGNALING_VERSION,
            type: "signal",
            to: msg.from,
            payload: { kind: "answer", sdp: answer.sdp! },
          });
        }
        return;
      }
      // Renegotiation: answer incoming offers on existing PC
      if (msg.payload.kind === "offer") {
        const answer = await pc.handleOffer({ type: "offer", sdp: msg.payload.sdp });
        ctx.signaling.send({
          v: SIGNALING_VERSION,
          type: "signal",
          to: msg.from,
          payload: { kind: "answer", sdp: answer.sdp! },
        });
        return;
      }
      // Encoding strategy from remote peer
      if (msg.payload.kind === "encoding-strategy") {
        const strategy = msg.payload.strategy;
        await pc.setEncodingStrategy(strategy);
        ctx.eventHandlers.get("strategy-change")?.forEach((h) => h(strategy));
        return;
      }
      // Remote peer requests device access
      if (msg.payload.kind === "request-mic") {
        ctx.eventHandlers.get("mic-request")?.forEach((h) => h());
        return;
      }
      if (msg.payload.kind === "request-camera") {
        ctx.eventHandlers.get("camera-request")?.forEach((h) => h());
        return;
      }
      await handleSignalPayload(msg.payload, pc);
      break;
    }
    case "error": {
      ctx.eventHandlers.get("error")?.forEach((h) => h(new Error(msg.message)));
      break;
    }
  }
}

async function handleSignalPayload(payload: SignalPayload, pc: PeerConnectionManager): Promise<void> {
  switch (payload.kind) {
    case "offer":
      await pc.handleOffer({ type: "offer", sdp: payload.sdp });
      break;
    case "answer":
      await pc.handleAnswer({ type: "answer", sdp: payload.sdp });
      break;
    case "candidate":
      await pc.addIceCandidate({ candidate: payload.ice.candidate, sdpMid: payload.ice.sdpMid, sdpMLineIndex: payload.ice.sdpMLineIndex });
      break;
    case "encoding-strategy":
      await pc.setEncodingStrategy(payload.strategy);
      break;
  }
}
