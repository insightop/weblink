import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    globals: {
      fetch: "readonly",
      WebSocket: "readonly",
      WebTransport: "readonly",
      AbortController: "readonly",
      performance: "readonly",
      crypto: "readonly",
    },
  }),
];
