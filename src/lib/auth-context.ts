import { cookies } from "next/headers";
import { SESSION_COOKIE, getAuthFromToken, type AuthContext } from "./auth-core";

// Server-only helpers. Import this module only from server components and
// route handlers (it depends on next/headers).

export async function getAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getAuthFromToken(token);
}

export async function getCurrentUser() {
  const ctx = await getAuthContext();
  return ctx?.user ?? null;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
