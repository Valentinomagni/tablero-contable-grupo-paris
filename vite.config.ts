/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Vitest solo corre los tests unitarios de src; los E2E (e2e/*.spec.ts) los corre Playwright.
  test: {
    include: ["src/**/*.test.ts"],
  },
});
