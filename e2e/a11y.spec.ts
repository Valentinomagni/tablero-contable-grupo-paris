import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Auditoría de accesibilidad con axe-core (tanda 2 de tooling).
// Gate: cero violaciones de impacto "critical" en las vistas clave.

test("a11y: sin violaciones críticas en Login y Resumen", async ({ page }) => {
  await page.goto("/");

  // Login (sin sesión)
  await page.waitForSelector('input[autocomplete="username"]');
  const loginScan = await new AxeBuilder({ page }).analyze();
  const loginCriticas = loginScan.violations.filter((v) => v.impact === "critical");
  expect(loginCriticas, JSON.stringify(loginCriticas, null, 2)).toEqual([]);

  // Resumen (post-login)
  await page.fill('input[autocomplete="username"]', "jefe1@grupoparis.com");
  await page.fill('input[type="password"]', "Paris2026!");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Resumen del equipo")).toBeVisible();

  const resumenScan = await new AxeBuilder({ page }).analyze();
  const resumenCriticas = resumenScan.violations.filter((v) => v.impact === "critical");
  expect(resumenCriticas, JSON.stringify(resumenCriticas, null, 2)).toEqual([]);
});
