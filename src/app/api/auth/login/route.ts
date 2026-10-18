import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, handle, ok, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { SESSION_COOKIE, createSession, verifyPassword } from "@/lib/auth-core";
import { sessionCookieOptions } from "@/lib/auth-context";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ip = getClientIp(req);
  const input = await readJson(req, loginSchema);
  const identifier = input.identifier.trim().toLowerCase();

  // Two windows: per-IP and per-identifier, to slow credential stuffing.
  enforceRateLimit(`login:ip:${ip ?? "unknown"}`, 20, 15 * 60 * 1000);
  enforceRateLimit(`login:id:${identifier}`, 10, 15 * 60 * 1000);

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  const invalid = new AppError(401, "INVALID_CREDENTIALS", "Email/username or password is incorrect.");

  if (!user) {
    // Constant-ish work to reduce user enumeration timing differences.
    await verifyPassword(input.password, "scrypt:32768:8:1:00:00");
    throw invalid;
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    await writeAudit({
      actorId: user.id,
      action: "user.login_failed",
      entityType: "User",
      entityId: user.id,
      ip,
    });
    throw invalid;
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended. Contact support for help.");
  }
  if (user.status === "DELETED") {
    throw invalid;
  }

  const session = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  await writeAudit({
    actorId: user.id,
    action: "user.login",
    entityType: "User",
    entityId: user.id,
    ip,
  });

  const response = ok({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
  });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return response;
});

export const GET = () =>
  NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to sign in." } },
    { status: 405 },
  );
