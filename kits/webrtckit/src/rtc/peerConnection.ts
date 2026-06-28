import type { RTCIceServer } from "./ice";

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: iceServers as RTCConfiguration["iceServers"],
    bundlePolicy: "balanced",
  });
}
