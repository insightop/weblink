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
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLTableElement: "readonly",
        HTMLTableSectionElement: "readonly",
        HTMLTableRowElement: "readonly",
        HTMLTableCellElement: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        SerialPort: "readonly",
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
    files: ["**/*.{ts,vue}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
