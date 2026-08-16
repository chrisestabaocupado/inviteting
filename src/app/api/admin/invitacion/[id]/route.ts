import { getInvitadoById, getEnteById } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, okResponse } from "@/lib/utils-server";

export async function GET(
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
  if (!invitado || invitado.estado_solicitud !== "aprobada") {
    return errResponse("Invitación no encontrada", 404);
  }
  const enteRow = await getEnteById(invitado.ente_id);
  return okResponse({
    invitado: {
      id: invitado.id,
      nombre: invitado.nombre,
      apellido: invitado.apellido,
      cargo: invitado.cargo,
      email: invitado.email,
      token_qr: invitado.token_qr,
    },
    ente: enteRow ? { id: enteRow.id, nombre: enteRow.nombre } : null,
  });
}
