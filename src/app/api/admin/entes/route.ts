import { z } from "zod";
import bcryptjs from "bcryptjs";
import { getEvento, getEntes, createEnte } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { generatePin, encryptPin } from "@/lib/crypto-utils";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

const createSchema = z.object({
  nombre: z.string().min(1).max(200),
  cupo_maximo: z.number().int().min(1).max(100).optional().default(5),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const eventoId = getEventoId(request);
  if (!eventoId) return errResponse("Evento requerido", 400);
  const entes = await getEntes(eventoId);
  // Nunca devolver pin_hash
  return okResponse(
    entes.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      cupo_maximo: e.cupo_maximo,
      evento_id: e.evento_id,
      creado_en: e.creado_en,
      actualizado_en: e.actualizado_en,
    }))
  );
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return errResponse("No autorizado", 401);
  }
  const eventoId = getEventoId(request);
  const evento = eventoId ? await getEvento(eventoId) : null;
  if (!evento) {
    return errResponse("No existe evento", 400);
  }
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("Datos inválidos", 400);
  }
  const pin = generatePin();
  const pinHash = await bcryptjs.hash(pin, 10);
  const pinEncrypted = encryptPin(pin);
  const ente = await createEnte({
    evento_id: evento.id,
    nombre: parsed.data.nombre,
    pin_hash: pinHash,
    pin_encrypted: pinEncrypted,
    cupo_maximo: parsed.data.cupo_maximo,
  });
  return okResponse({
    id: ente.id,
    nombre: ente.nombre,
    cupo_maximo: ente.cupo_maximo,
    pin,
  });
}
