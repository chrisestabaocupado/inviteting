import { z } from "zod";
import { createEvento, deleteEvento, getEvento, getEventos, updateEvento } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { errResponse, okResponse } from "@/lib/utils-server";

const eventoSchema = z.object({
  nombre: z.string().min(1).max(200),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
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
  return okResponse(await getEventos());
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = eventoSchema.extend({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }
  const { id, ...data } = parsed.data;
  const evento = await updateEvento(id, data);
  if (!evento) return errResponse("Evento no encontrado", 404);
  return okResponse(evento);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = eventoSchema.safeParse(body);
  if (!parsed.success) return errResponse("Datos inválidos", 400);
  return okResponse(await createEvento(parsed.data), 201);
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = z.object({
    id: z.string().uuid(),
    confirmacion: z.string().min(1).max(200),
  }).safeParse(body);
  if (!parsed.success) return errResponse("Confirmación inválida", 400);

  const evento = await getEvento(parsed.data.id);
  if (!evento) return errResponse("Evento no encontrado", 404);
  if (parsed.data.confirmacion !== evento.nombre) {
    return errResponse("El nombre del evento no coincide", 400);
  }
  const deleted = await deleteEvento(evento.id, evento.nombre);
  if (!deleted) return errResponse("El evento cambió; vuelve a confirmar", 409);
  return okResponse({ deleted: true });
}
