import type {
  IceCandidatePayload as BaseIceCandidatePayload,
  SignalPayload as BaseSignalPayload,
} from "@weblink/webrtckit";
import { SIGNALING_VERSION } from "@weblink/webrtckit";

// Re-export unchanged types
export type IceCandidatePayload = BaseIceCandidatePayload;
export { SIGNALING_VERSION } from "@weblink/webrtckit";

// Streamkit-specific encoding strategy
export type EncodingStrategy = "auto" | "speed" | "quality";

// Extended SignalPayload with streamkit-specific kinds
export type SignalPayload =
  | BaseSignalPayload
  | { kind: "encoding-strategy"; strategy: EncodingStrategy }
  | { kind: "request-mic" }
  | { kind: "request-camera" };

// Messages use the extended SignalPayload
export type ClientToServerMessage =
  | { v: typeof SIGNALING_VERSION; type: "signal"; to: string; payload: SignalPayload }
  | { v: typeof SIGNALING_VERSION; type: "ping" };

export type ServerToClientMessage =
  | { v: typeof SIGNALING_VERSION; type: "welcome"; peers: string[]; self: string }
  | { v: typeof SIGNALING_VERSION; type: "peer-joined"; peerId: string }
  | { v: typeof SIGNALING_VERSION; type: "peer-left"; peerId: string }
  | { v: typeof SIGNALING_VERSION; type: "signal"; from: string; payload: SignalPayload }
  | { v: typeof SIGNALING_VERSION; type: "error"; message: string };
