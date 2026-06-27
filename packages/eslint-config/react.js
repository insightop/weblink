import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const BASE_IGNORES = ["**/dist/**", "**/dist-ssr/**", "**/coverage/**", "**/node_modules/**"];

const COMMON_TS_RULES = {
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
};

/**
 * Base flat config for React + TypeScript apps in the monorepo.
 */
export function weblinkReactTsConfig(options = {}) {
  const { files = "**/*.{ts,tsx}", ignores = [], globals: extraGlobals = {} } = options;

  return defineConfig([
    globalIgnores([...BASE_IGNORES, ...ignores]),
    {
      name: "weblink-react/files",
      files: [files],
    },
    {
      name: "weblink-react/globals",
      languageOptions: {
        globals: { ...globals.browser, ...extraGlobals },
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
      },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      name: "weblink-react/ts-rules",
      files: ["**/*.{ts,tsx}"],
      rules: COMMON_TS_RULES,
    },
  ]);
}
