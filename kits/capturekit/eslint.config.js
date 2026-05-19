import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    globals: {
      MediaStream: "readonly",
      MediaStreamTrack: "readonly",
      MediaDevices: "readonly",
    },
  }),
];
