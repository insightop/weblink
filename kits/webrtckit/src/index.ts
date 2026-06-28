// Signaling
export { createSignalingClient } from "./signaling/client"
export type { SignalingTransport } from "./signaling/transport"
export { parseServerMessage, stringifyClientMessage } from "./signaling/codec"
export { buildSignalingWsUrl } from "./signaling/url"
export { isPolitePeer } from "./signaling/roomPolicy"
export type {
  IceCandidatePayload,
  SignalPayload,
  ClientToServerMessage,
  ServerToClientMessage,
} from "./signaling/types"
export { SIGNALING_VERSION } from "./signaling/types"

// RTC
export { PeerSession } from "./rtc/peerSession"
export { createPeerConnection } from "./rtc/peerConnection"
export { captureUserMedia, captureDisplayMedia } from "./rtc/mediaCapture"
export { createDebugDataChannel, acceptDebugDataChannel } from "./rtc/dataChannel"
export { DEFAULT_ICE_SERVERS, parseIceServersInput } from "./rtc/ice"
export { MeshGraph } from "./rtc/mesh"
export type { RTCIceServer } from "./rtc/ice"

// Utils
export { randomPeerId, randomRoomId } from "./utils/id"
