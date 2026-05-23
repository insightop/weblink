import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
    },
  },
  optimizeDeps: {
    include: ["dapjs"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
