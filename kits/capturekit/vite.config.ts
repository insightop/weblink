import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";
import { fileURLToPath, URL } from "node:url";

export default mergeConfig(
  kitBaseConfig({
    kitRoot: fileURLToPath(new URL(".", import.meta.url)),
  }),
  defineConfig({
    server: {
      port: 5174,
      strictPort: false,
      open: "/",
    },
  }),
);
