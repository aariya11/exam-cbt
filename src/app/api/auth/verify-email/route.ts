import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson } from "@/lib/api";
import { verifyEmailSchema } from "@/lib/validation";
import { hashToken } from "@/lib/auth-core";
import { badRequest } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  enforceRateLimit(`verify-email:${getClientIp(req) ?? "unknown"}`, 20, 60 * 60 * 1000);

  const { token } = await readJson(req, verifyEmailSchema);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badRequest("This verification link is invalid or has expired. Request a new one from your account page.");
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    }),
  ]);

  await writeAudit({
    actorId: record.userId,
    action: "user.email_verified",
    entityType: "User",
    entityId: record.userId,
  });

  return ok({ verified: true, email: record.user.email });
});
