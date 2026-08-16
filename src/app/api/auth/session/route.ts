import { getSession } from "@/lib/auth";
import { okResponse, errResponse } from "@/lib/utils-server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return errResponse("No autenticado", 401);
  }
  return okResponse({ admin: session.admin });
}
