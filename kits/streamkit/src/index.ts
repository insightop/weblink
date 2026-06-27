/**
 * @weblink/streamkit-core
 *
 * Framework-agnostic SDK for WebRTC-based remote support sessions.
 * Provides signaling, peer connection, media capture, and room management.
 */
export { createRoom, joinRoom, generateShareCode } from "./room/roomManager";
export type { SessionOptions, Session, SessionEventMap, SessionState } from "./room/roomTypes";
export { captureScreen, captureMicrophone } from "./webrtc/mediaTrack";
export type { LocalMedia } from "./webrtc/mediaTrack";
export { TopControlBar } from "./components/TopControlBar";
export { StreamKitPlugin } from "./plugin/StreamKitPlugin";
