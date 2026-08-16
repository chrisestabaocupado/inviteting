import { z } from "zod";
import { safeCompare } from "@/lib/crypto-utils";
import { createSession } from "@/lib/auth";
import { checkRateLimit, recordFailed, recordSuccess, makeHuella } from "@/lib/rate-limit";
import { errResponse, okResponse } from "@/lib/utils-server";

const bodySchema = z.object({
  pin: z.string().min(1).max(20),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errResponse("PIN requerido", 400);
  }

  const huella = makeHuella("auth-general", parsed.data.pin);
  const rl = await checkRateLimit(huella, "pin_general");
  if (!rl.ok) {
    return errResponse(rl.error, rl.status);
  }

  const valid = safeCompare(parsed.data.pin, process.env.GENERAL_ACCESS_PIN ?? "");
  if (!valid) {
    await recordFailed(huella, "pin_general");
    return errResponse("PIN inválido", 401);
  }

  await recordSuccess(huella);
  await createSession(true);
  return okResponse({ session: true });
}
