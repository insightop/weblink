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
        USBDevice: "readonly",
        USBDeviceFilter: "readonly",
        USBInTransferResult: "readonly",
        USBOutTransferResult: "readonly",
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
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "prettier.config.cjs"],
  },
];
