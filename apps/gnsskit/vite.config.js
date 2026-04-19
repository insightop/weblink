import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 单页应用：仓库根目录 index.html → 访问路径为 / */
export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    open: "/",
  },
});
