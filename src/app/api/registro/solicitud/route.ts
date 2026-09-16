import bcryptjs from "bcryptjs";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { ente, invitado as invitadoTable } from "@/db/schema";
import { getEnteById, getEvento } from "@/db/queries";
import {
  checkRateLimit,
  makeHuella,
  recordFailed,
  recordSuccess,
} from "@/lib/rate-limit";
import { solicitudRegistroSchema } from "@/lib/registro";
import { generateQrToken } from "@/lib/crypto-utils";
import { errResponse, okResponse } from "@/lib/utils-server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = solicitudRegistroSchema.safeParse(body);

  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
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
    const invitado = await db.transaction(async (txDb) => {
      const enteRows = await txDb
        .select()
        .from(ente)
        .where(eq(ente.id, enteRow.id))
        .for("update");
      if (!enteRows.length) {
        throw new Error("Ente no encontrado");
      }
      const usedRows = await txDb
        .select({ count: count() })
        .from(invitadoTable)
        .where(
          and(
            eq(invitadoTable.ente_id, enteRow.id),
            eq(invitadoTable.estado_solicitud, "aprobada")
          )
        );
      if (usedRows[0].count >= enteRows[0].cupo_maximo) {
        throw new Error("Cupo agotado para este ente");
      }

      const duplicateRows = await txDb
        .select({ id: invitadoTable.id })
        .from(invitadoTable)
        .where(
          and(
            eq(invitadoTable.evento_id, evento.id),
            sql`lower(${invitadoTable.email}) = ${parsed.data.email}`,
            inArray(invitadoTable.estado_solicitud, ["pendiente", "aprobada"])
          )
        )
        .limit(1);

      if (duplicateRows.length) {
        throw new Error("El email ya está registrado");
      }

      const rows = await txDb
        .insert(invitadoTable)
        .values({
          evento_id: evento.id,
          ente_id: enteRow.id,
          nombre: parsed.data.nombre,
          cargo: parsed.data.cargo,
          email: parsed.data.email,
          telefono: parsed.data.telefono,
          confirmacion: parsed.data.confirmacion,
          origen: "publico",
          estado_solicitud: "aprobada",
          estado_invitacion: "no_enviada",
          token_qr: generateQrToken(),
          aprobado_en: new Date(),
        })
        .returning();
      return rows[0];
    });

    return okResponse(invitado);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const databaseError = error as { code?: string; constraint?: string };

    if (message.includes("Cupo agotado")) {
      return errResponse("Cupo agotado para este ente", 409);
    }

    if (
      message.includes("registrado") ||
      (databaseError.code === "23505" &&
        databaseError.constraint === "invitado_email_unico")
    ) {
      return errResponse("El email ya está registrado", 409);
    }

    throw error;
  }
}
