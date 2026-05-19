import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

const BASE_IGNORES = ["**/dist/**", "**/dist-ssr/**", "**/coverage/**", "**/node_modules/**"];

const COMMON_VUE_RULES = {
  "vue/multi-word-component-names": "off",
  "vue/singleline-html-element-content-newline": "off",
  "vue/max-attributes-per-line": "off",
};

const COMMON_TS_RULES = {
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

/**
 * Base flat config for Vue + TypeScript apps in the monorepo.
 */
export function weblinkVueTsConfig(options = {}) {
  const { vueFiles = "**/*.{vue,ts,tsx}", ignores = [], globals: extraGlobals = {} } = options;

  return defineConfig([
    globalIgnores([...BASE_IGNORES, ...ignores]),
    {
      name: "weblink/files",
      files: [vueFiles],
    },
    {
      name: "weblink/globals",
      languageOptions: {
        globals: { ...globals.browser, ...extraGlobals },
      },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs["flat/recommended"],
    {
      name: "weblink/vue-rules",
      files: ["**/*.vue"],
      languageOptions: {
        parserOptions: {
          parser: tseslint.parser,
          extraFileExtensions: [".vue"],
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      rules: COMMON_VUE_RULES,
    },
    {
      name: "weblink/ts-rules",
      files: ["**/*.{ts,vue}"],
      rules: COMMON_TS_RULES,
    },
  ]);
}

/**
 * Base flat config for pure JavaScript apps in the monorepo.
 */
export function weblinkJsConfig(options = {}) {
  const { jsFiles = "**/*.js", ignores = [], globals: extraGlobals = {} } = options;

  return defineConfig([
    globalIgnores([...BASE_IGNORES, ...ignores]),
    {
      name: "weblink-js/files",
      files: [jsFiles],
    },
    {
      name: "weblink-js/globals",
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        globals: { ...globals.browser, ...extraGlobals },
      },
    },
    js.configs.recommended,
    {
      name: "weblink-js/rules",
      files: [jsFiles],
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "no-constant-condition": ["error", { checkLoops: false }],
      },
    },
  ]);
}

export default weblinkVueTsConfig;
