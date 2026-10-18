import { handle, ok, readSessionToken } from "@/lib/api";
import { getAuthFromToken } from "@/lib/auth-core";

export const GET = handle(async (req: Request) => {
  const token = readSessionToken(req);
  const ctx = token ? await getAuthFromToken(token) : null;
  if (!ctx) return ok({ authenticated: false, user: null });
  return ok({ authenticated: true, user: ctx.user });
});
