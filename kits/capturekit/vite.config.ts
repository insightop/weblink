import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";

export default mergeConfig(
  kitBaseConfig(),
  defineConfig({
    server: {
      port: 5174,
      strictPort: false,
      open: "/",
    },
  }),
);
