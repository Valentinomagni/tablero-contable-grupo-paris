import { defineConfig } from "@playwright/test";

// E2E real con Playwright. Local: usa el Edge del sistema (channel msedge) para NO descargar
// navegadores (PC sin permisos de admin). En CI (env CI=true): usa el chromium que instala
// `npx playwright install --with-deps chromium` en el workflow, y levanta el build con
// `vite preview` vía webServer (reusa el server si ya está corriendo en local).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: process.env.E2E_URL || "http://localhost:8124",
    channel: process.env.CI ? "chromium" : "msedge",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 8124",
    url: "http://localhost:8124",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
