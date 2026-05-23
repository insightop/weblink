import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/naive-ui")) {
            return "naive-ui";
          }
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
