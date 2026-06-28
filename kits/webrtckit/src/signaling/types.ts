/** Protocol version embedded in every frame */
export const SIGNALING_VERSION = 1 as const;

export type IceCandidatePayload = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "candidate"; ice: IceCandidatePayload };

/** Browser -> server (over WebSocket after connected) */
export type ClientToServerMessage =
  | { v: typeof SIGNALING_VERSION; type: "signal"; to: string; payload: SignalPayload }
  | { v: typeof SIGNALING_VERSION; type: "ping" };

/** Server -> browser */
export type ServerToClientMessage =
  | { v: typeof SIGNALING_VERSION; type: "welcome"; peers: string[]; self: string }
  | { v: typeof SIGNALING_VERSION; type: "peer-joined"; peerId: string }
  | { v: typeof SIGNALING_VERSION; type: "peer-left"; peerId: string }
  | { v: typeof SIGNALING_VERSION; type: "signal"; from: string; payload: SignalPayload }
  | { v: typeof SIGNALING_VERSION; type: "error"; message: string };
