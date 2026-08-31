import { defineConfig, mergeConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react-swc";

export default mergeConfig(
  {
    plugins: [vue(), react()],
    test: {
      environment: "happy-dom",
      include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
      passWithNoTests: true,
    },
  },
  defineConfig({}),
);
