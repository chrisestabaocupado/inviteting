import { z } from "zod";
import { getEnteById, updateEnte, deleteEnte } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

const patchSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
});

export async function PATCH(
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
  const existing = await getEnteById(id);
  if (!eventoId || existing?.evento_id !== eventoId) {
    return errResponse("Ente no encontrado", 404);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }
  const ente = await updateEnte(id, parsed.data);
  if (!ente) {
    return errResponse("Ente no encontrado", 404);
  }
  return okResponse({
    id: ente.id,
    nombre: ente.nombre,
    cupo_maximo: ente.cupo_maximo,
  });
}

export async function DELETE(
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
  const ente = await getEnteById(id);
  if (!eventoId || !ente || ente.evento_id !== eventoId) {
    return errResponse("Ente no encontrado", 404);
  }
  await deleteEnte(id);
  return okResponse({ deleted: true });
}
