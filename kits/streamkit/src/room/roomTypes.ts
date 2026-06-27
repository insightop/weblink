import type { EncodingStrategy } from "../signaling/messageTypes";

/**
 * Session type definitions for StreamKit Core.
 */

export interface SessionOptions {
  /** WebSocket signaling server base URL */
  signalingUrl: string;
  /**
   * Room ID (8-digit share code).
   * For createRoom: leave blank to auto-generate.
   * For joinRoom: required.
   */
  roomId?: string;
  /** Override default ICE servers configuration */
  iceServers?: RTCIceServer[];
}

export type SessionState = "connecting" | "connected" | "disconnected" | "error";

export interface Session {
  readonly roomId: string;
  readonly peerId: string;
  readonly state: SessionState;
  readonly remoteStreams: ReadonlyMap<string, MediaStream>;
  /** Secondary camera stream from remote, if available */
  readonly cameraStream: MediaStream | null;

  on<K extends keyof SessionEventMap>(event: K, handler: SessionEventMap[K]): void;
  off<K extends keyof SessionEventMap>(event: K, handler: SessionEventMap[K]): void;

  /** Add a local media track to send to the remote peer. Returns the RTCRtpSender. */
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
  /** Remove a sender previously added via addTrack */
  removeTrack(sender: RTCRtpSender): void;
  /** Adjust video encoding strategy (affects bitrate/resolution) */
  setEncodingStrategy(strategy: EncodingStrategy): Promise<void>;
  /** Ask the remote peer to enable their microphone (sends signal) */
  requestMic(): void;
  /** Ask the remote peer to enable their camera (sends signal) */
  requestCamera(): void;
  /** Dispose the session, close all connections */
  dispose(): void;
}

export interface SessionEventMap {
  "remote-stream": (peerId: string, stream: MediaStream) => void;
  "remote-track-removed": (peerId: string, track: MediaStreamTrack) => void;
  "peer-joined": (peerId: string) => void;
  "peer-left": (peerId: string) => void;
  "state-change": (state: SessionState) => void;
  "strategy-change": (strategy: EncodingStrategy) => void;
  /** A secondary video stream (camera) has been added/removed */
  "camera-stream": (stream: MediaStream | null) => void;
  /** Remote peer requests us to enable microphone */
  "mic-request": () => void;
  /** Remote peer requests us to enable camera */
  "camera-request": () => void;
  "error": (error: Error) => void;
}
