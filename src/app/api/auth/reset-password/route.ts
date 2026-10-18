import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, handle, ok, readJson } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword, hashToken, revokeAllSessionsForUser } from "@/lib/auth-core";
import { badRequest } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  enforceRateLimit(`reset:${getClientIp(req) ?? "unknown"}`, 10, 60 * 60 * 1000);

  const input = await readJson(req, resetPasswordSchema);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badRequest("This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
  ]);

  // A password change invalidates every existing session.
  await revokeAllSessionsForUser(record.userId);

  await writeAudit({
    actorId: record.userId,
    action: "user.password_reset",
    entityType: "User",
    entityId: record.userId,
  });

  return ok({ reset: true, message: "Your password has been updated. Sign in with your new password." });
});
