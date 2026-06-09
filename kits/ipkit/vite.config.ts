import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";

export default mergeConfig(
  kitBaseConfig({ test: true }),
  defineConfig({
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
  }),
);
