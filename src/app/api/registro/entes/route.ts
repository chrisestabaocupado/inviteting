import { getEvento, getEntes } from "@/db/queries";
import { okResponse, errResponse } from "@/lib/utils-server";

export async function GET() {
  const evento = await getEvento();
  if (!evento) {
    return errResponse("No existe evento", 404);
  }
  const entes = await getEntes();
  return okResponse(
    entes.map((e) => ({ id: e.id, nombre: e.nombre, cupo_maximo: e.cupo_maximo }))
  );
}
