import { z } from "zod";
import bcryptjs from "bcryptjs";
import {
  getEvento,
  getEnteById,
  countInvitadosPorEnte,
  insertInvitado,
} from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { generateQrToken } from "@/lib/crypto-utils";
import { db } from "@/db/index";
import { ente, invitado as invitadoTable } from "@/db/schema";
import { eq, and, count, inArray } from "drizzle-orm";
import { errResponse, okResponse } from "@/lib/utils-server";

const manualSchema = z.object({
  ente_id: z.string().uuid(),
  nombre: z.string().min(1).max(200),
  apellido: z.string().min(1).max(200),
  cargo: z.string().min(1).max(200),
  email: z.string().email().min(1),
  telefono: z.string().min(1).max(50),
  confirmacion: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const evento = await getEvento();
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

  const email = parsed.data.email.trim().toLowerCase();

  // Transacción: FOR UPDATE + chequeo cupo + insert
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

    const token = generateQrToken();
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
}
