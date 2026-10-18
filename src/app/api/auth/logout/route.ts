import { assertSameOrigin, handle, ok } from "@/lib/api";
import { SESSION_COOKIE, getAuthFromToken, revokeSession } from "@/lib/auth-core";
import { readSessionToken } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const token = readSessionToken(req);
  if (token) {
    const ctx = await getAuthFromToken(token);
    if (ctx) {
      await revokeSession(ctx.sessionId);
    }
  }
  const response = ok({ signedOut: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
});
