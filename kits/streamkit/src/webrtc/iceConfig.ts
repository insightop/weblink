/**
 * WebRTC ICE 配置
 * Cloudflare STUN 服务器
 */
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.cloudflare.com:53" },
  ],
  iceTransportPolicy: "all",
};
