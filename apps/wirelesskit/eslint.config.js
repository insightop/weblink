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
        BluetoothDevice: "readonly",
        BluetoothRemoteGATTServer: "readonly",
        BluetoothRemoteGATTService: "readonly",
        BluetoothRemoteGATTCharacteristic: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLTextAreaElement: "readonly",
        NDEFReader: "readonly",
        NDEFMessage: "readonly",
        NDEFRecord: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
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
      "vue/no-mutating-props": "off",
      "vue/html-self-closing": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "prettier.config.cjs"],
  },
];
