import { defineConfig, mergeConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react-swc";

export default mergeConfig(
  {
    plugins: [vue(), react()],
    test: {
      environment: "node",
      include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    },
  },
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
