import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

function buildTimeTag(): string {
  return new Date().toJSON();
}

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? "/",
  define: {
    __BUILD_TIME__: JSON.stringify(buildTimeTag()),
  },
  plugins: [
    basicSsl(),
    vue(),
    react(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Weblink",
        short_name: "Weblink",
        theme_color: "#2080f0",
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "::",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        ws: true,
      },
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
