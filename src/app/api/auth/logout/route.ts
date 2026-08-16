import { clearSession } from "@/lib/auth";
import { okResponse } from "@/lib/utils-server";

export async function POST() {
  await clearSession();
  return okResponse({ session: false });
}
