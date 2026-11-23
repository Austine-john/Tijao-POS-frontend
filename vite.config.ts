/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Where the bench lives relative to this folder, and the Frappe dev server to proxy to.
const APP_DIR = path.resolve(__dirname, "../backend/frappe-bench/apps/tijao_pos/tijao_pos");
const FRAPPE_URL = process.env.FRAPPE_URL ?? "http://localhost:8000";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Production: Frappe serves the build from apps/tijao_pos/tijao_pos/public/frontend
  // at /assets/tijao_pos/frontend/. Dev: Vite serves from /.
  base: command === "build" ? "/assets/tijao_pos/frontend/" : "/",
  build: {
    outDir: path.join(APP_DIR, "public/frontend"),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Same-origin in the browser -> Frappe's session cookie just works.
    proxy: Object.fromEntries(
      ["/api", "/assets", "/files", "/private"].map((p) => [p, { target: FRAPPE_URL, changeOrigin: true }]),
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
