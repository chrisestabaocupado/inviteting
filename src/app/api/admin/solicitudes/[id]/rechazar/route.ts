import { getInvitadoById, updateInvitadoEstado } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const { id } = await params;
  const eventoId = getEventoId(request);
  const invitado = await getInvitadoById(id);
  if (!eventoId || !invitado || invitado.evento_id !== eventoId) {
    return errResponse("Solicitud no encontrada", 404);
  }
  if (invitado.estado_solicitud !== "pendiente") {
    return errResponse("La solicitud no está pendiente", 400);
  }
  const updated = await updateInvitadoEstado(id, "rechazada");
  return okResponse(updated);
}
