import { DEFAULT_ICE_SERVERS } from "@weblink/webrtckit";

/**
 * WebRTC ICE 配置
 * 基于 @weblink/webrtckit 的默认 STUN 服务器
 */
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: DEFAULT_ICE_SERVERS as RTCConfiguration["iceServers"],
  iceTransportPolicy: "all",
};
