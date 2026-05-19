import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    globals: {
      RTCPeerConnection: "readonly",
      RTCSessionDescription: "readonly",
      RTCIceCandidate: "readonly",
      MediaStream: "readonly",
      MediaStreamTrack: "readonly",
    },
  }),
];
