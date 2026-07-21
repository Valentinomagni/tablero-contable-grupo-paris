import { test, expect } from "@playwright/test";

// Flujo crítico end-to-end contra la app real (login → vistas clave → delegar).
// Auto-espera de Playwright: sin sleeps arbitrarios, con trace viewer si algo falla.

test("login, vistas clave y delegar tarea", async ({ page }) => {
  test.skip(!process.env.E2E_USER || !process.env.E2E_PASSWORD, "E2E_USER/E2E_PASSWORD no configuradas");
  await page.goto("/");
  await page.fill('input[autocomplete="username"]', process.env.E2E_USER!);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
  await page.click('button[type="submit"]');

  await expect(page.getByText("Resumen del equipo")).toBeVisible();

  // cerrar el modal de "Novedades" si aparece (sesión de browser nueva sin localStorage)
  const novedadesBtn = page.getByRole("button", { name: "Entendido" });
  if (await novedadesBtn.isVisible().catch(() => false)) {
    await novedadesBtn.click();
  }

  // abrir el modal de delegar/compartir
  await page.getByRole("button", { name: /Delegar tarea/ }).click();
  await expect(page.getByText("Delegar / compartir tarea")).toBeVisible();
  await page.keyboard.press("Escape");

  // navegar a Cierre mensual
  await page.getByRole("button", { name: "Cierre mensual" }).first().click();
  await expect(page.getByRole("heading", { name: /de \d{4}/ })).toBeVisible();
});
