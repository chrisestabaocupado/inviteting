import { getInvitadoById, getEnteById, getEvento } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

export async function GET(
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
  if (
    !eventoId ||
    !invitado ||
    invitado.evento_id !== eventoId ||
    invitado.estado_solicitud !== "aprobada"
  ) {
    return errResponse("Invitación no encontrada", 404);
  }
  const enteRow = await getEnteById(invitado.ente_id);
  const evento = await getEvento(invitado.evento_id);
  return okResponse({
    invitado: {
      id: invitado.id,
      nombre: invitado.nombre,
      cargo: invitado.cargo,
      email: invitado.email,
      token_qr: invitado.token_qr,
    },
    ente: enteRow ? { id: enteRow.id, nombre: enteRow.nombre } : null,
    evento: evento
      ? {
          id: evento.id,
          nombre: evento.nombre,
          fecha: evento.fecha,
          hora: evento.hora,
          lugar: evento.lugar,
          descripcion: evento.descripcion,
        }
      : null,
  });
}
