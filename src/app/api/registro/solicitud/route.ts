import { z } from "zod";
import bcryptjs from "bcryptjs";
import {
  getEvento,
  getEnteById,
  countInvitadosPorEnte,
} from "@/db/queries";
import { checkRateLimit, recordFailed, recordSuccess, makeHuella } from "@/lib/rate-limit";
import { generateQrToken } from "@/lib/crypto-utils";
import { db } from "@/db/index";
import { ente, invitado as invitadoTable } from "@/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import { errResponse, okResponse } from "@/lib/utils-server";

const solicitudSchema = z.object({
  ente_id: z.string().uuid(),
  pin: z.string().length(6).regex(/^\d{6}$/),
  nombre: z.string().min(1).max(200),
  apellido: z.string().min(1).max(200),
  cargo: z.string().min(1).max(200),
  email: z.string().email(),
  telefono: z.string().min(1).max(50),
  confirmacion: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const evento = await getEvento();
  if (!evento) {
    return errResponse("No existe evento", 400);
  }
  if (!evento.inscripciones_abiertas) {
    return errResponse("Las inscripciones están cerradas", 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = solicitudSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }

  const enteRow = await getEnteById(parsed.data.ente_id);
  if (!enteRow || enteRow.evento_id !== evento.id) {
    return errResponse("Ente no válido", 400);
  }

  // Rate-limit por PIN ente
  const huella = makeHuella("pin-ente", `${enteRow.id}:${parsed.data.pin}`);
  const rl = await checkRateLimit(huella, "pin_ente");
  if (!rl.ok) {
    return errResponse(rl.error, rl.status);
  }

  const validPin = await bcryptjs.compare(parsed.data.pin, enteRow.pin_hash);
  if (!validPin) {
    await recordFailed(huella, "pin_ente");
    return errResponse("PIN de ente inválido", 401);
  }
  await recordSuccess(huella);

  const email = parsed.data.email.trim().toLowerCase();

  // Transacción: FOR UPDATE + chequeo cupo + insert
  try {
    const result = await db.transaction(async (txDb) => {
      const enteRows = await txDb
        .select()
        .from(ente)
        .where(eq(ente.id, parsed.data.ente_id))
        .for("update");
      if (!enteRows.length) {
        throw new Error("Ente no encontrado");
      }
      const enteData = enteRows[0];
      const usedRows = await txDb
        .select({ count: count() })
        .from(invitadoTable)
        .where(
          and(
            eq(invitadoTable.ente_id, enteData.id),
            inArray(invitadoTable.estado_solicitud, ["pendiente", "aprobada"])
          )
        );
      const used = usedRows[0].count;
      if (used >= enteData.cupo_maximo) {
        throw new Error("Cupo agotado para este ente");
      }

      // Chequeo email único (parcial: pendiente/aprobada)
      const dupRows = await txDb
        .select()
        .from(invitadoTable)
        .where(
          and(
            eq(invitadoTable.evento_id, evento.id),
            eq(invitadoTable.email, email),
            inArray(invitadoTable.estado_solicitud, ["pendiente", "aprobada"])
          )
        )
        .limit(1);
      if (dupRows.length) {
        throw new Error("El email ya está registrado");
      }

      const inv = await txDb
        .insert(invitadoTable)
        .values({
          evento_id: evento.id,
          ente_id: enteData.id,
          nombre: parsed.data.nombre,
          apellido: parsed.data.apellido,
          cargo: parsed.data.cargo,
          email,
          telefono: parsed.data.telefono,
          confirmacion: parsed.data.confirmacion,
          origen: "publico",
          estado_solicitud: "pendiente",
          estado_invitacion: "no_enviada",
        })
        .returning();
      return inv[0];
    });
    return okResponse(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (msg.includes("Cupo agotado")) {
      return errResponse("Cupo agotado para este ente", 409);
    }
    if (msg.includes("email") || msg.includes("Email") || msg.includes("registrado")) {
      return errResponse("El email ya está registrado", 409);
    }
    throw e;
  }
}
