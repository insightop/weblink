import { weblinkVueTsConfig } from "@weblink/eslint-config";
import { weblinkReactTsConfig } from "@weblink/eslint-config/react";

export default [
  ...weblinkVueTsConfig({
    vueFiles: "src/**/*.vue",
    globals: {
      RTCPeerConnection: "readonly",
      RTCSessionDescription: "readonly",
      RTCIceCandidate: "readonly",
      MediaStream: "readonly",
      MediaStreamTrack: "readonly",
      WebSocketPair: "readonly",
    },
  }),
  ...weblinkReactTsConfig({
    files: "src/**/*.{ts,tsx}",
    globals: {
      RTCPeerConnection: "readonly",
      RTCSessionDescription: "readonly",
      RTCIceCandidate: "readonly",
      MediaStream: "readonly",
      MediaStreamTrack: "readonly",
    },
  }),
];
