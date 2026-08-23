import { getEvento, getEventos, getEntes } from "@/db/queries";
import { okResponse, errResponse, getEventoId } from "@/lib/utils-server";

export async function GET(request: Request) {
  const rawId = new URL(request.url).searchParams.get("evento");
  const requestedId = getEventoId(request);
  if (rawId && !requestedId) return errResponse("Evento no válido", 404);
  const eventos = rawId ? [] : await getEventos();
  const evento = requestedId
    ? await getEvento(requestedId)
    : eventos.length === 1
      ? eventos[0]
      : null;
  if (!evento) {
    return errResponse(
      eventos.length > 1 ? "Selecciona un evento" : "No existe evento",
      404
    );
  }
  const entes = await getEntes(evento.id);
  return okResponse({
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      fecha: evento.fecha,
      hora: evento.hora,
      lugar: evento.lugar,
      inscripciones_abiertas: evento.inscripciones_abiertas,
    },
    entes: entes.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      cupo_maximo: e.cupo_maximo,
    })),
  });
}
