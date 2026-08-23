import { z } from "zod";
import { getInvitadosConDetalle } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

const querySchema = z.object({
  estado: z.enum(["pendiente", "aprobada", "rechazada", "revocada"]).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    estado: searchParams.get("estado") ?? undefined,
  });
  const estado = parsed.success ? parsed.data.estado : undefined;

  const eventoId = getEventoId(request);
  if (!eventoId) return errResponse("Evento requerido", 400);
  const solicitudes = await getInvitadosConDetalle(eventoId, estado);
  return okResponse(solicitudes);
}
