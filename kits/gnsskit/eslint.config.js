import { weblinkJsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkJsConfig({
    globals: {
      localStorage: "readonly",
      location: "readonly",
      alert: "readonly",
      confirm: "readonly",
      prompt: "readonly",
      getComputedStyle: "readonly",
      setTimeout: "readonly",
      clearTimeout: "readonly",
      setInterval: "readonly",
      clearInterval: "readonly",
    },
  }),
];
