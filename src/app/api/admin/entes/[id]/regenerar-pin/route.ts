import bcryptjs from "bcryptjs";
import { getEnteById, updateEnte } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { generatePin, encryptPin } from "@/lib/crypto-utils";
import { errResponse, getEventoId, okResponse } from "@/lib/utils-server";

export async function POST(
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
  const pin = generatePin();
  const pinHash = await bcryptjs.hash(pin, 10);
  const pinEncrypted = encryptPin(pin);
  await updateEnte(id, { pin_hash: pinHash, pin_encrypted: pinEncrypted });
  return okResponse({ id, pin });
}
