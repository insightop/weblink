import js from "@eslint/js";
import eslintPluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs["flat/recommended"],
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: {
        navigator: "readonly",
        File: "readonly",
        USBDevice: "readonly",
        USBDeviceFilter: "readonly",
        SerialPort: "readonly",
        HIDDevice: "readonly",
        HIDDeviceFilter: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: {
        navigator: "readonly",
        window: "readonly",
        document: "readonly",
        File: "readonly",
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/legacy/**"],
  },
];
