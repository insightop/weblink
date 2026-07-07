import { weblinkVueTsConfig } from "@weblink/eslint-config";
import { weblinkReactTsConfig } from "@weblink/eslint-config/react";

export default [
  ...weblinkVueTsConfig({
    vueFiles: "src/**/*.vue",
    globals: {
      WebTransport: "readonly",
      WebTransportDatagramDuplexStream: "readonly",
      WebTransportBidirectionalStream: "readonly",
      WebTransportReceiveStream: "readonly",
      WebTransportSendStream: "readonly",
    },
  }),
  ...weblinkReactTsConfig({
    files: "src/**/*.{ts,tsx}",
    globals: {
      WebTransport: "readonly",
      WebTransportDatagramDuplexStream: "readonly",
      WebTransportBidirectionalStream: "readonly",
      WebTransportReceiveStream: "readonly",
      WebTransportSendStream: "readonly",
    },
  }),
];
