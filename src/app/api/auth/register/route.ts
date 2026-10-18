import { NextResponse } from "next/server";
import { prisma, isUniqueConstraintError } from "@/lib/db";
import { assertSameOrigin, created, fail, getClientIp, handle, readJson } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import {
  SESSION_COOKIE,
  autoVerifyEmail,
  createSession,
  devExposeTokens,
  hashPassword,
  issueEmailVerificationToken,
} from "@/lib/auth-core";
import { sessionCookieOptions } from "@/lib/auth-context";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildVerificationEmail, sendMail } from "@/lib/mail";
import { isRegistrationOpen } from "@/lib/settings";
import { conflict, forbidden } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ip = getClientIp(req);
  enforceRateLimit(`register:${ip ?? "unknown"}`, 5, 60 * 60 * 1000);

  if (!(await isRegistrationOpen())) {
    throw forbidden("New registrations are temporarily paused. Please try again later.");
  }

  const input = await readJson(req, registerSchema);
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    if (existing.email === email) {
      throw conflict("An account with this email already exists. Try signing in instead.", "EMAIL_TAKEN");
    }
    throw conflict("This username is already taken. Please choose another.", "USERNAME_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const verifiedNow = autoVerifyEmail();

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: input.displayName.trim(),
        passwordHash,
        state: input.state || null,
        city: input.city || null,
        emailVerifiedAt: verifiedNow ? new Date() : null,
        consents: {
          create: { kind: "TERMS", version: "1.0" },
        },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("An account with these details already exists.", "DUPLICATE_ACCOUNT");
    }
    throw error;
  }

  let devVerificationUrl: string | undefined;
  if (!verifiedNow) {
    const token = await issueEmailVerificationToken(user.id);
    await sendMail(buildVerificationEmail(user.email, token, user.displayName));
    if (devExposeTokens()) {
      devVerificationUrl = `/verify-email?token=${token}`;
    }
  }

  await writeAudit({
    actorId: user.id,
    action: "user.registered",
    entityType: "User",
    entityId: user.id,
    after: { email: user.email, username: user.username },
    ip,
  });

  const session = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  const response = created({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
    ...(devVerificationUrl ? { devVerificationUrl } : {}),
  });
  response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return response;
});

export const GET = () => fail(405, "METHOD_NOT_ALLOWED", "Use POST to register.");
