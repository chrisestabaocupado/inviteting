import { getInvitadoById, updateInvitadoEstado } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { generateQrToken } from "@/lib/crypto-utils";
import { errResponse, okResponse } from "@/lib/utils-server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const { id } = await params;
  const invitado = await getInvitadoById(id);
  if (!invitado) {
    return errResponse("Invitación no encontrada", 404);
  }
  if (invitado.estado_solicitud !== "aprobada") {
    return errResponse("La invitación no está activa", 400);
  }
  const updated = await updateInvitadoEstado(id, "revocada", { token_qr: null });
  return okResponse(updated);
}
