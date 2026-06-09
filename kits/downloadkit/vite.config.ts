import { defineConfig, mergeConfig } from "vite";
import { kitBaseConfig } from "@weblink/vite-config";
import { fileURLToPath, URL } from "node:url";

function buildTimeTag(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const M = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${y}${M}${d}${h}${m}`;
}

export default mergeConfig(
  kitBaseConfig({
    kitRoot: fileURLToPath(new URL(".", import.meta.url)),
    test: true,
  }),
  defineConfig({
    base: "/downloadkit/",
    define: {
      __BUILD_TIME__: JSON.stringify(buildTimeTag()),
    },
    optimizeDeps: {
      include: ["dapjs"],
    },
  }),
);
