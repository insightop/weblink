import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve("../web"),
    plugins: [vue()],
    build: {
      outDir: resolve("../web/dist"),
      rollupOptions: {
        input: resolve("../web/index.html"),
      },
    },
    resolve: {
      alias: {
        "@": resolve("../web/src"),
      },
    },
  },
});
