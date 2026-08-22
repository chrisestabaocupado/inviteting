import { getEnteById } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";
import { decryptPin } from "@/lib/crypto-utils";
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
  const ente = await getEnteById(id);
  if (!ente) {
    return errResponse("Ente no encontrado", 404);
  }
  if (!ente.pin_encrypted) {
    return errResponse("PIN no disponible: regenera el PIN para poder revelarlo", 400);
  }
  try {
    const pin = decryptPin(ente.pin_encrypted);
    return okResponse({ id, pin });
  } catch {
    return errResponse("No se pudo descifrar el PIN", 500);
  }
}
