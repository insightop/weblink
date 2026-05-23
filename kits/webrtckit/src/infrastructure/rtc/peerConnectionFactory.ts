import type { RTCIceServer } from "../../domain/rtc/iceTypes";

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: iceServers as RTCConfiguration["iceServers"],
    bundlePolicy: "balanced",
  });
}
