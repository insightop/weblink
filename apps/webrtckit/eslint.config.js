import js from "@eslint/js";
import vueParser from "vue-eslint-parser";
import vuePlugin from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vuePlugin.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      globals: {
        HTMLElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLVideoElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLTextAreaElement: "readonly",
        RTCPeerConnection: "readonly",
        RTCSessionDescription: "readonly",
        RTCIceCandidate: "readonly",
        MediaStream: "readonly",
        RTCDataChannel: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        crypto: "readonly",
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/max-attributes-per-line": "off",
    },
  },
  {
    files: ["workers/**/*.ts"],
    languageOptions: {
      globals: {
        WebSocket: "readonly",
        WebSocketPair: "readonly",
        Request: "readonly",
        Response: "readonly",
        TextDecoder: "readonly",
        DurableObjectState: "readonly",
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
