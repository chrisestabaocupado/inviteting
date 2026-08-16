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
    return errResponse("Solicitud no encontrada", 404);
  }
  if (invitado.estado_solicitud !== "pendiente") {
    return errResponse("La solicitud no está pendiente", 400);
  }
  const token = generateQrToken();
  const updated = await updateInvitadoEstado(id, "aprobada", { token_qr: token });
  return okResponse(updated);
}
