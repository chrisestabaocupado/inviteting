import bcryptjs from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { invitado as invitadoTable } from "@/db/schema";
import { getEnteById, getEvento } from "@/db/queries";
import {
  checkRateLimit,
  makeHuella,
  recordFailed,
  recordSuccess,
} from "@/lib/rate-limit";
import { solicitudRegistroSchema } from "@/lib/registro";
import { errResponse, okResponse } from "@/lib/utils-server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = solicitudRegistroSchema.safeParse(body);

  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }

  const emails = parsed.data.personas.map((persona) => persona.email);
  if (new Set(emails).size !== emails.length) {
    return errResponse("Hay correos repetidos en la solicitud", 409);
  }

  const evento = await getEvento(parsed.data.evento_id);
  if (!evento) return errResponse("No existe evento", 400);
  if (!evento.inscripciones_abiertas) {
    return errResponse("Las inscripciones están cerradas", 403);
  }

  const enteRow = await getEnteById(parsed.data.ente_id);
  if (!enteRow || enteRow.evento_id !== evento.id) {
    return errResponse("Ente no válido", 400);
  }

  const huella = makeHuella(
    "pin-ente",
    `${enteRow.id}:${parsed.data.pin}`
  );
  const rateLimit = await checkRateLimit(huella, "pin_ente");
  if (!rateLimit.ok) {
    return errResponse(rateLimit.error, rateLimit.status);
  }

  const validPin = await bcryptjs.compare(parsed.data.pin, enteRow.pin_hash);
  if (!validPin) {
    await recordFailed(huella, "pin_ente");
    return errResponse("PIN de ente inválido", 401);
  }
  await recordSuccess(huella);

  try {
    const result = await db.transaction(async (txDb) => {
      const duplicateRows = await txDb
        .select({ email: invitadoTable.email })
        .from(invitadoTable)
        .where(
          and(
            eq(invitadoTable.evento_id, evento.id),
            sql`lower(${invitadoTable.email}) in (${sql.join(
              emails.map((email) => sql`${email}`),
              sql`, `
            )})`,
            inArray(invitadoTable.estado_solicitud, ["pendiente", "aprobada"])
          )
        )
        .limit(1);

      if (duplicateRows.length) {
        throw new Error("Uno de los correos ya está registrado");
      }

      return txDb
        .insert(invitadoTable)
        .values(
          parsed.data.personas.map((persona) => ({
            evento_id: evento.id,
            ente_id: enteRow.id,
            nombre: persona.nombre,
            cargo: persona.cargo,
            email: persona.email,
            telefono: persona.telefono,
            confirmacion: parsed.data.confirmacion,
            origen: "publico" as const,
            estado_solicitud: "pendiente" as const,
            estado_invitacion: "no_enviada" as const,
          }))
        )
        .returning();
    });

    return okResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const databaseError = error as { code?: string; constraint?: string };

    if (
      message.includes("registrado") ||
      (databaseError.code === "23505" &&
        databaseError.constraint === "invitado_email_unico")
    ) {
      return errResponse("Uno de los correos ya está registrado", 409);
    }

    throw error;
  }
}
