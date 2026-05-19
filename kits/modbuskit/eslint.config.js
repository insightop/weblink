// eslint.config.js
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

/** @type {import('eslint').Linter.FlatConfig[]} */
const base = ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,          // TS core rules
  ...svelte.configs.recommended,      // Svelte rules
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    rules: {
      // disable base rule (TS version is smarter)
      "no-unused-vars": "off",

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  }
);

// Limit every block to src/. If a block already has `files`, prefix them with `src/`.
const scoped = base.map(cfg => ({
  ...cfg,
  files: cfg.files
    ? cfg.files.map(p => `src/${p.replace(/^\/+/, "")}`)
    : ["src/**/*.{js,cjs,mjs,ts,cts,mts,svelte}"],
}));

export default [
  // Optional ignores
  { ignores: ["**/node_modules/**", "**/dist/**", "**/build/**"] },
  ...scoped,
];
