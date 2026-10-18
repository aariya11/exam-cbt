import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, handle, ok, readJson, requireAuth } from "@/lib/api";
import { deleteAccountSchema, profileUpdateSchema } from "@/lib/validation";
import { createSession, hashPassword, revokeAllSessionsForUser, SESSION_COOKIE, verifyPassword } from "@/lib/auth-core";
import { sessionCookieOptions } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

export const GET = handle(async (req: Request) => {
  const auth = await requireAuth(req);
  const [user, consents, attemptCount, achievementCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        state: true,
        city: true,
        timezone: true,
        role: true,
        leaderboardOptOut: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    prisma.consentRecord.findMany({
      where: { userId: auth.user.id },
      orderBy: { grantedAt: "desc" },
      take: 20,
    }),
    prisma.attempt.count({ where: { userId: auth.user.id } }),
    prisma.userAchievement.count({ where: { userId: auth.user.id } }),
  ]);

  return ok({
    user: {
      ...user,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    consents: consents.map((consent) => ({
      kind: consent.kind,
      version: consent.version,
      grantedAt: consent.grantedAt.toISOString(),
      revokedAt: consent.revokedAt?.toISOString() ?? null,
    })),
    stats: { attempts: attemptCount, achievements: achievementCount },
  });
});

export const PATCH = handle(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth(req);
  const input = await readJson(req, profileUpdateSchema);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });

  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.state !== undefined) data.state = input.state || null;
  if (input.city !== undefined) data.city = input.city || null;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.leaderboardOptOut !== undefined) data.leaderboardOptOut = input.leaderboardOptOut;
  if (Object.keys(data).length === 0 && !input.newPassword) {
    throw badRequest("No changes were provided.");
  }

  let passwordChanged = false;
  if (input.newPassword) {
    if (!input.currentPassword) throw badRequest("Enter your current password to change it.");
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) throw badRequest("Your current password is not correct.");
    const sameAsOld = await verifyPassword(input.newPassword, user.passwordHash);
    if (sameAsOld) throw badRequest("Choose a password different from your current one.");
    data.passwordHash = await hashPassword(input.newPassword);
    passwordChanged = true;
  }

  const before = {
    displayName: user.displayName,
    state: user.state,
    city: user.city,
    timezone: user.timezone,
    leaderboardOptOut: user.leaderboardOptOut,
  };

  await prisma.user.update({ where: { id: user.id }, data });

  if (passwordChanged) {
    // Changing the password ends every other session but keeps this one.
    await revokeAllSessionsForUser(user.id);
    const session = await createSession(user.id, {
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    const response = ok({ updated: true, passwordChanged: true });
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    await writeAudit({
      actorId: user.id,
      action: "auth.password_changed",
      entityType: "User",
      entityId: user.id,
      ip: getClientIp(req),
    });
    return response;
  }

  await writeAudit({
    actorId: user.id,
    action: "profile.updated",
    entityType: "User",
    entityId: user.id,
    before,
    after: { ...data, passwordHash: undefined },
  });

  return ok({ updated: true, passwordChanged: false });
});

export const DELETE = handle(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireAuth(req);
  const input = await readJson(req, deleteAccountSchema);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw badRequest("Your password is not correct.");

  await writeAudit({
    actorId: user.id,
    action: "account.deleted",
    entityType: "User",
    entityId: user.id,
    before: { username: user.username, email: user.email },
    ip: getClientIp(req),
  });

  // Ranking snapshots have no foreign key to User; remove them explicitly.
  await prisma.rankingSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  const response = ok({
    deleted: true,
    message: "Your account and personal data have been deleted.",
  });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
  return response;
});
