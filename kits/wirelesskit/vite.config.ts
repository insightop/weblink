import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  build:
    command === "build"
      ? {
          lib: {
            entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
            formats: ["es"],
            fileName: "index",
          },
          rollupOptions: {
            external: [
              "vue",
              "naive-ui",
              "pinia",
              "vue-router",
              "vue-i18n",
              "@weblink/ui-vue",
              "@weblink/utils",
              "@weblink/tokens",
              /^naive-ui\//,
              /^@vicons\//,
              /^@lucide\//,
              /^pinia/,
              /^vue-router/,
              /^vue-i18n/,
              "pino",
              "splitpanes",
              "splitpanes/dist/splitpanes.css",
            ],
          },
          cssCodeSplit: false,
        }
      : undefined,
}));
