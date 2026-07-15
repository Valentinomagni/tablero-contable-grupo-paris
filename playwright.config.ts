import { defineConfig } from "@playwright/test";

// E2E real con Playwright. Usa el Edge del sistema (channel msedge) para NO descargar navegadores
// (PC sin permisos de admin). Levantá el server antes:  npm run build && server en :8124.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: process.env.E2E_URL || "http://localhost:8124",
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
