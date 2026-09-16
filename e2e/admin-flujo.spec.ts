import { test, expect } from "@playwright/test";

/**
 * E2E: flujo completo por UI (sin API seeding) para evitar problemas de cookies.
 * Timeout elevado porque crea ente, guarda evento y registra invitado por UI.
 */

test.setTimeout(90_000);

const pin = process.env.GENERAL_ACCESS_PIN ?? "1234";

test("flujo completo: login → evento → ente → registro → QR", async ({ page }) => {
  const ts = Date.now();

  // ===== 1. Login admin =====
  await page.goto("/admin");
  await page.waitForSelector("text=Acceso administrativo");
  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.locator("h2").first()).toBeVisible();

  // ===== 2. Configurar evento con inscripciones abiertas =====
  await page.getByRole("button", { name: "Evento", exact: true }).click();
  await expect(page.getByText("Datos del evento")).toBeVisible();
  await page.getByLabel("Nombre del evento").fill(`Evento E2E ${ts}`);
  await page.getByLabel("Fecha").fill("2026-12-31");
  await page.getByLabel("Hora").fill("19:00");
  await page.getByLabel("Lugar").fill("Caracas E2E");
  await page.getByLabel("Descripción").fill("Evento de prueba E2E");

  // Si las inscripciones están cerradas, abrirlas haciendo click en el switch
  const inscripcionesLabel = page.locator('text=Inscripciones cerradas');
  if (await inscripcionesLabel.count() > 0) {
    await page.locator('[role="switch"]').first().click();
  }

  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(page).toHaveURL(/evento=[0-9a-f-]+/);
  const eventoId = new URL(page.url()).searchParams.get("evento");
  expect(eventoId).toBeTruthy();

  // ===== 3. Crear ente =====
  await page.click('button:has-text("Entes")');
  await page.waitForSelector("text=Entes invitados");
  await page.getByRole("button", { name: "Nuevo ente" }).click();
  await page.fill('input[placeholder="Ej. Embajada de España"]', `Ente E2E ${ts}`);
  await page.click('button:has-text("Crear ente")');
  await page.waitForSelector("text=Ente creado");

  // Extraer PIN del toast
  const toastText = await page.locator("text=Ente creado").textContent();
  const pinMatch = toastText?.match(/PIN:\s*(\d{6})/);
  const entePin = pinMatch ? pinMatch[1] : "";
  const enteNombre = `Ente E2E ${ts}`;

  // ===== 4. Registrar un invitado =====
  const email = `e2e-${ts}@example.com`;
  await page.goto(`/registro?evento=${eventoId}`);
  await page.waitForSelector("text=Registro de invitados");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: enteNombre }).click();
  await expect(page.getByRole("combobox")).toContainText(enteNombre);
  await page.fill('[placeholder="••••••"]', entePin);
  await page.getByPlaceholder("Nombre y apellido").fill("Nombre Apellido E2E");
  await page.fill('[placeholder="Ej. Directora de Protocolo"]', "CargoE2E");
  await page.fill('[placeholder="nombre@correo.com"]', email);
  await page.fill('[placeholder="+58 412 000 0000"]', "+58000000001");
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  // ===== 5. QR inmediato y descarga PDF =====
  await expect(page.getByText("Registro exitoso")).toBeVisible();
  await expect(page.getByAltText("Código QR de Nombre Apellido E2E")).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();

  // ===== 6. Verificar aprobación en admin =====
  await page.goto(`/admin?evento=${eventoId}`);
  await page.click('button:has-text("Invitados")');
  await expect(page.locator("text=Nombre Apellido E2E")).toBeVisible();
  await expect(page.locator('button:has-text("Descargar")').first()).toBeVisible();
});

test("(c) login con PIN válido en /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("text=Acceso administrativo")).toBeVisible();
  await page.fill('input[type="password"]', pin);
  await page.click('button:has-text("Entrar")');
  await expect(page.locator("h2").first()).toBeVisible();
});
