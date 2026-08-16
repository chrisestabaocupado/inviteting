import { z } from "zod";
import { getEvento, upsertEvento } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, okResponse } from "@/lib/utils-server";

const eventoSchema = z.object({
  nombre: z.string().min(1).max(200),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  lugar: z.string().min(1).max(200),
  descripcion: z.string().min(1).max(1000),
  inscripciones_abiertas: z.boolean(),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const evento = await getEvento();
  if (!evento) {
    return errResponse("Evento no encontrado", 404);
  }
  return okResponse(evento);
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = eventoSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }
  const evento = await upsertEvento(parsed.data);
  return okResponse(evento);
}
