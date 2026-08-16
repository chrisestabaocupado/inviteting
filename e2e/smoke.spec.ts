import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests — cubren recorridos principales del inviteting.
 * Usa la BD real (Neon); ejecutar solo en entorno de desarrollo.
 */

const pin = process.env.GENERAL_ACCESS_PIN ?? "1234";

test("login con PIN válido en /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("text=Acceso administrativo")).toBeVisible();

  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
});

test("página /registro carga el formulario", async ({ page }) => {
  await page.goto("/registro");
  await expect(page.locator("text=Registro de invitados")).toBeVisible();
  await expect(page.locator('button:has-text("Enviar solicitud")')).toBeVisible();
});

test("página /scanner carga el lector tras login", async ({ page }) => {
  await page.goto("/scanner");
  await page.waitForSelector("text=Acceso administrativo");
  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.locator("text=Escáner de entrada")).toBeVisible();
});
