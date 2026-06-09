import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";

export default mergeConfig(
  kitBaseConfig({ test: true }),
  defineConfig({
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }),
);
