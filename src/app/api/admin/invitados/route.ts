import { z } from "zod";
import {
  getEvento,
  getEnteById,
} from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { generateQrToken } from "@/lib/crypto-utils";
import { db } from "@/db/index";
import { ente, invitado as invitadoTable } from "@/db/schema";
import { eq, and, count, inArray, sql } from "drizzle-orm";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";
import { personaRegistroSchema } from "@/lib/registro";

const manualSchema = personaRegistroSchema.extend({
  ente_id: z.string().uuid(),
  confirmacion: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const eventoId = getEventoId(request);
  const evento = eventoId ? await getEvento(eventoId) : null;
  if (!evento) {
    return errResponse("No existe evento", 400);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = manualSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }
  const enteRow = await getEnteById(parsed.data.ente_id);
  if (!enteRow || enteRow.evento_id !== evento.id) {
    return errResponse("Ente no válido", 400);
  }

  const email = parsed.data.email;

  // Transacción: FOR UPDATE + chequeo cupo + insert
  try {
    const tx = await db.transaction(async (txDb) => {
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
            eq(invitadoTable.estado_solicitud, "aprobada")
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
            sql`lower(${invitadoTable.email}) = ${email}`,
            inArray(invitadoTable.estado_solicitud, ["pendiente", "aprobada"])
          )
        )
        .limit(1);
      if (dupRows.length) {
        throw new Error("El email ya está registrado");
      }

      const token = generateQrToken();
      const inv = await txDb
        .insert(invitadoTable)
        .values({
          evento_id: evento.id,
          ente_id: enteData.id,
          nombre: parsed.data.nombre,
          cargo: parsed.data.cargo,
          email,
          telefono: parsed.data.telefono,
          confirmacion: parsed.data.confirmacion,
          origen: "manual",
          estado_solicitud: "aprobada",
          estado_invitacion: "no_enviada",
          token_qr: token,
          aprobado_en: new Date(),
        })
        .returning();
      return inv[0];
    });

    return okResponse(tx);
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
