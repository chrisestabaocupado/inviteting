# inviteting

Sistema de gestión de invitaciones para eventos protocolares. Construido con Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM y PostgreSQL (Neon).

## Características

- **Registro público múltiple**: cada ente puede enviar hasta 5 funcionarios por solicitud usando un PIN de ente (6 dígitos), con nombre completo y datos de contacto propios por funcionario.
- **Panel administrativo**: protegido con PIN general; gestiona evento, entes, solicitudes e invitados.
- **Múltiples eventos**: selector de workspace con entes e invitados aislados por evento.
- **Código QR por invitado**: generado al aprobar; escaneable en entrada.
- **PDF de invitación**: generado en el navegador con `@react-pdf/renderer` + QR embebido.
- **Scanner**: validación de QR con `html5-qrcode`.

## Requisitos

- Node.js 22+
- pnpm
- Cuenta en [Neon](https://neon.tech) (PostgreSQL serverless)

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión de Neon (`postgresql://...`) |
| `GENERAL_ACCESS_PIN` | PIN numérico de 4-20 dígitos para acceso administrativo |
| `SESSION_SECRET` | Secreto JWT para cookies de sesión (mínimo 32 caracteres) |
| `PIN_ENCRYPTION_KEY` | Clave para cifrar los PIN de ente (AES-256-GCM); 64 hex. Sin ella no se pueden revelar PINs |

## Configurar base de datos (Neon)

1. Crea un proyecto en Neon y copia la **Connection string** (psql).
2. Establece `DATABASE_URL` en `.env`.
3. Ejecuta migraciones:

```bash
pnpm exec drizzle-kit migrate
```

4. Crea y cambia eventos desde el selector superior del panel administrativo (`/admin`).

Cada evento expone enlaces propios de registro y escáner con `?evento=<id>` desde la pestaña **Evento**.

El registro múltiple es atómico: si falta cupo o alguno de los correos ya está registrado, no se crea ninguna persona del envío.

## Scripts

```bash
pnpm dev          # Servidor de desarrollo (puerto 3000)
pnpm build        # Build de producción
pnpm start        # Servidor de producción
pnpm test         # Tests unitarios con Vitest
pnpm exec playwright test  # Tests E2E con Playwright
```

## Desplegar en Vercel

1. Importa el repositorio en [Vercel](https://vercel.com/new).
2. En **Environment Variables**, añade las 3 variables del `.env`.
3. Build command: `pnpm build` (Vercel lo detecta automáticamente).
4. Framework preset: **Next.js**.
5. Despliega.

> Nota: para serverless, usa la **Connection string** de Neon con SSL activado (incluido por defecto en las URLs de Neon).

## Tests

- **Unitarios**: Vitest (`src/**/*.test.ts`).
- **E2E**: Playwright (`e2e/`). El `playwright.config.ts` levanta automáticamente `pnpm start` en un puerto libre.

> Los tests E2E usan la base de datos real. Ejecútalos solo en entorno de desarrollo.

## Estructura clave

```
src/
  app/
    admin/page.tsx          # Panel administrativo
    registro/page.tsx       # Formulario público
    scanner/page.tsx        # Lector QR
    api/                    # Route handlers
  db/
    schema.ts               # Esquema Drizzle
    queries.ts              # Capa de datos
  components/
    pin-gate.tsx            # Login por PIN
    invitacion-pdf.tsx      # Documento PDF con QR
```

## Licencia

MIT
