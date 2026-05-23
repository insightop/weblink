import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
