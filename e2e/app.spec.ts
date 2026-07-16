import { test, expect } from "@playwright/test";

// Flujo crítico end-to-end contra la app real (login → vistas clave → delegar).
// Auto-espera de Playwright: sin sleeps arbitrarios, con trace viewer si algo falla.

test("login, vistas clave y delegar tarea", async ({ page }) => {
  await page.goto("/");
  await page.fill('input[autocomplete="username"]', "jefe1@grupoparis.com");
  await page.fill('input[type="password"]', "Paris2026!");
  await page.click('button[type="submit"]');

  await expect(page.getByText("Resumen del equipo")).toBeVisible();

  // abrir el modal de delegar/compartir
  await page.getByRole("button", { name: /Delegar tarea/ }).click();
  await expect(page.getByText("Delegar / compartir tarea")).toBeVisible();
  await page.keyboard.press("Escape");

  // navegar a Cierre mensual
  await page.getByRole("button", { name: "Cierre mensual" }).first().click();
  await expect(page.getByRole("heading", { name: /de \d{4}/ })).toBeVisible();
});
