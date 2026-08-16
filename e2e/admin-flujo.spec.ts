import { test, expect } from "@playwright/test";

/**
 * E2E: flujo completo por UI (sin API seeding) para evitar problemas de cookies.
 * Timeout elevado porque crea ente, guarda evento y registra invitado por UI.
 */

test.setTimeout(90_000);

const pin = process.env.GENERAL_ACCESS_PIN ?? "1234";

test("flujo completo: login → evento → ente → registro → aprobar → QR", async ({ page }) => {
  const ts = Date.now();

  // ===== 1. Login admin =====
  await page.goto("/admin");
  await page.waitForSelector("text=Acceso administrativo");
  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();

  // ===== 2. Configurar evento con inscripciones abiertas =====
  await page.click('button:has-text("Evento")');
  await page.waitForSelector("text=Datos del evento");
  await page.fill('input[value] >> nth=0', `Evento E2E ${ts}`);
  await page.fill('input[type="date"]', "2026-12-31");
  await page.fill('input[type="time"]', "19:00");
  await page.fill('input[value] >> nth=3', "Caracas E2E");
  await page.fill("textarea", "Evento de prueba E2E");

  // Si las inscripciones están cerradas, abrirlas haciendo click en el switch
  const inscripcionesLabel = page.locator('text=Inscripciones cerradas');
  if (await inscripcionesLabel.count() > 0) {
    await page.locator('[role="switch"]').first().click();
  }

  await page.click('button:has-text("Guardar cambios")');
  await page.waitForSelector("text=Cambios guardados");

  // ===== 3. Crear ente =====
  await page.click('button:has-text("Entes")');
  await page.waitForSelector("text=Entes invitados");
  await page.click('button:has-text("+")');
  await page.fill('input[placeholder="Ej. Embajada de España"]', `Ente E2E ${ts}`);
  await page.click('button:has-text("Crear ente")');
  await page.waitForSelector("text=Ente creado");

  // Extraer PIN del toast
  const toastText = await page.locator("text=Ente creado").textContent();
  const pinMatch = toastText?.match(/PIN:\s*(\d{6})/);
  const entePin = pinMatch ? pinMatch[1] : "";
  const enteNombre = `Ente E2E ${ts}`;

  // ===== 4. Registrar invitado =====
  const guestEmail = `e2e-${ts}@example.com`;
  await page.goto("/registro");
  await page.waitForSelector("text=Registro de invitados");
  await page.click('[placeholder="Selecciona tu ente…"]');
  await page.click(`text=${enteNombre}`);
  await page.fill('[placeholder="••••••"]', entePin);
  await page.fill('[placeholder="Nombre"]', "NombreE2E");
  await page.fill('[placeholder="Apellido"]', "ApellidoE2E");
  await page.fill('[placeholder="Ej. Directora de Protocolo"]', "CargoE2E");
  await page.fill('[placeholder="nombre@correo.com"]', guestEmail);
  await page.fill('[placeholder="+58 412 000 0000"]', "+58000000001");
  await page.click("role=checkbox");
  await page.click('button:has-text("Enviar solicitud")');
  await expect(page.locator("text=Solicitud enviada")).toBeVisible();

  // ===== 5. Aprobar en admin =====
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
  await expect(page.locator(`text=${guestEmail}`)).toBeVisible();

  const card = page.locator(`text=${guestEmail}`).locator("xpath=../..");
  await card.locator('button:has-text("Aprobar")').click();
  await expect(page.locator("text=Solicitud aprobada")).toBeVisible();

  // ===== 6. Verificar QR en Invitados =====
  await page.click('button:has-text("Invitados")');
  await expect(page.locator("text=NombreE2E")).toBeVisible();
  await expect(page.locator('button:has-text("Descargar")').first()).toBeVisible();
});

test("(c) login con PIN válido en /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("text=Acceso administrativo")).toBeVisible();
  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
});
