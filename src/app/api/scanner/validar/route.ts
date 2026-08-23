import { z } from "zod";
import {
  getInvitadoByToken,
  getEntradaByInvitado,
  insertEntrada,
  getEnteById,
} from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, okResponse } from "@/lib/utils-server";

const bodySchema = z.object({
  evento_id: z.string().uuid(),
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Token requerido", 400);
  }

  const invitado = await getInvitadoByToken(parsed.data.token);
  if (!invitado || invitado.evento_id !== parsed.data.evento_id) {
    return errResponse("Token inválido", 404);
  }
  if (invitado.estado_solicitud !== "aprobada") {
    return errResponse("Invitación no válida", 403);
  }

  const existente = await getEntradaByInvitado(invitado.id);
  if (existente) {
    return okResponse({
      estado: "ya_utilizado",
      nombre: invitado.nombre,
      cargo: invitado.cargo,
      ente: (await getEnteById(invitado.ente_id))?.nombre ?? null,
      hora_entrada: existente.creado_en,
    });
  }

  // Insertar entrada atómicamente; si ya existe (race), capturamos UNIQUE
  try {
    const entry = await insertEntrada(invitado.id);
    return okResponse({
      estado: "valida",
      nombre: invitado.nombre,
      cargo: invitado.cargo,
      ente: (await getEnteById(invitado.ente_id))?.nombre ?? null,
      hora_entrada: entry.creado_en,
    });
  } catch (e) {
    // Si UNIQUE constraint violado → ya utilizado
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("UNIQUE")) {
      const existente2 = await getEntradaByInvitado(invitado.id);
      return okResponse({
        estado: "ya_utilizado",
        nombre: invitado.nombre,
        cargo: invitado.cargo,
        ente: (await getEnteById(invitado.ente_id))?.nombre ?? null,
        hora_entrada: existente2?.creado_en ?? new Date(),
      });
    }
    throw e;
  }
}
