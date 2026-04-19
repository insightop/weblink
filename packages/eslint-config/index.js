import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

/**
 * Base flat config for Vue + TypeScript apps in the monorepo.
 * Apps extend this and add `files` / `languageOptions.parserOptions.project` as needed.
 */
export function weblinkVueTsConfig(options = {}) {
  const { vueFiles = "**/*.{vue,ts,tsx}", ignores = [] } = options;

  return defineConfig([
    globalIgnores(["**/dist/**", "**/dist-ssr/**", "**/coverage/**", "**/node_modules/**", ...ignores]),
    {
      name: "weblink/files",
      files: [vueFiles],
    },
    {
      name: "weblink/globals",
      languageOptions: {
        globals: { ...globals.browser },
      },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs["flat/recommended"],
    {
      name: "weblink/vue-rules",
      files: ["**/*.vue"],
      rules: {
        "vue/multi-word-component-names": "off",
      },
    },
  ]);
}

export default weblinkVueTsConfig;
