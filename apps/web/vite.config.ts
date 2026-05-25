import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
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

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? "/",
  define: {
    __BUILD_TIME__: JSON.stringify(buildTimeTag()),
  },
  plugins: [vue()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@weblink/")) {
            const match = id.match(/@weblink\/([^/]+)/);
            if (match) return `kit-${match[1]}`;
          }
        },
      },
    },
  },
}));
