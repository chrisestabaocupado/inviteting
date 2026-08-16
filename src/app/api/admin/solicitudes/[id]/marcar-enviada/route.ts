import { getInvitadoById, markInvitacionEnviada } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
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
  if (invitado.estado_solicitud !== "aprobada") {
    return errResponse("La solicitud no está aprobada", 400);
  }
  const updated = await markInvitacionEnviada(id);
  return okResponse(updated);
}
