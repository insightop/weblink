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
    port: 5174,
    strictPort: false,
    open: "/",
  },
});
