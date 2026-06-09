import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";
import { fileURLToPath, URL } from "node:url";

export default mergeConfig(
  kitBaseConfig({
    kitRoot: fileURLToPath(new URL(".", import.meta.url)),
    test: true,
  }),
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
