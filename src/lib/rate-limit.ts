import { hashHuella } from "./crypto-utils";
import { getIntentoByHuella, upsertIntentoFallido, resetIntento } from "@/db/queries";

const MAX_ATTEMPTS = 5;
const BLOCK_MS = 10 * 60 * 1000;

export function makeHuella(origen: string, proposito: string): string {
  return hashHuella(`${origen}:${proposito}`);
}

export async function checkRateLimit(
  huella: string,
  tipo: "pin_general" | "pin_ente"
): Promise<{ ok: false; error: string; status: number } | { ok: true }> {
  const registro = await getIntentoByHuella(huella);
  if (registro) {
    if (registro.expira_en && registro.expira_en.getTime() > Date.now()) {
      return {
        ok: false,
        error: "Demasiados intentos fallidos. Intenta más tarde.",
        status: 429,
      };
    }
    if (
      registro.intentos_fallidos >= MAX_ATTEMPTS &&
      (!registro.ultimo_fallo_en ||
        Date.now() - registro.ultimo_fallo_en.getTime() < BLOCK_MS)
    ) {
      await upsertIntentoFallido(
        huella,
        tipo,
        registro.intentos_fallidos,
        new Date(Date.now() + BLOCK_MS)
      );
      return {
        ok: false,
        error: "Demasiados intentos fallidos. Intenta más tarde.",
        status: 429,
      };
    }
  }
  return { ok: true };
}

export async function recordFailed(huella: string, tipo: "pin_general" | "pin_ente") {
  const registro = await getIntentoByHuella(huella);
  const intentos = (registro?.intentos_fallidos ?? 0) + 1;
  const expira = intentos >= MAX_ATTEMPTS ? new Date(Date.now() + BLOCK_MS) : null;
  await upsertIntentoFallido(huella, tipo, intentos, expira);
}

export async function recordSuccess(huella: string) {
  await resetIntento(huella);
}
