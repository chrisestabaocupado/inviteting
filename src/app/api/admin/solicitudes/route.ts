import { z } from "zod";
import { getEvento, getInvitadosByEstado } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, okResponse } from "@/lib/utils-server";

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

  const evento = await getEvento();
  if (!evento) {
    return errResponse("No existe evento", 404);
  }
  const solicitudes = await getInvitadosByEstado(evento.id, estado);
  return okResponse(solicitudes);
}
