/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vite.dev/config/
// Análisis de bundle opt-in: `ANALYZE=1 npm run build` genera dist/stats.html
export default defineConfig({
  plugins: [react(), ...(process.env.ANALYZE ? [visualizer({ filename: "dist/stats.html", gzipSize: true })] : [])],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Vitest solo corre los tests unitarios de src; los E2E (e2e/*.spec.ts) los corre Playwright.
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
});
