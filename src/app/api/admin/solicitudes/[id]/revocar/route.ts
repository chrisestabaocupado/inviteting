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
    return errResponse("Invitación no encontrada", 404);
  }
  if (invitado.estado_solicitud !== "aprobada") {
    return errResponse("La invitación no está activa", 400);
  }
  const updated = await updateInvitadoEstado(id, "revocada", { token_qr: null });
  return okResponse(updated);
}
