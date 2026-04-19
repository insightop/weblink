const js = require("@eslint/js");

const IGNORES = ["dist/**", "node_modules/**"];

module.exports = [
  { ignores: IGNORES },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    ignores: IGNORES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        HTMLSelectElement: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        location: "readonly",
        fetch: "readonly",
        Response: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        getComputedStyle: "readonly",
        TextDecoder: "readonly",
        Blob: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
];

