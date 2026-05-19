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
              "@weblink/ui-vue",
              "@weblink/utils",
              "@weblink/tokens",
              /^naive-ui\//,
              /^@vicons\//,
            ],
          },
          cssCodeSplit: false,
        }
      : undefined,
}));
