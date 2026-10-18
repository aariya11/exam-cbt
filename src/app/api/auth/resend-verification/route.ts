import { assertSameOrigin, getClientIp, handle, ok, requireAuth } from "@/lib/api";
import { autoVerifyEmail, devExposeTokens, issueEmailVerificationToken } from "@/lib/auth-core";
import { buildVerificationEmail, sendMail } from "@/lib/mail";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = await requireAuth(req);
  enforceRateLimit(`resend-verify:${ctx.user.id}`, 3, 60 * 60 * 1000);

  if (ctx.user.emailVerifiedAt || autoVerifyEmail()) {
    return ok({ sent: false, message: "Your email address is already verified." });
  }

  const token = await issueEmailVerificationToken(ctx.user.id);
  await sendMail(buildVerificationEmail(ctx.user.email, token, ctx.user.displayName));
  await prisma.auditLog.create({
    data: {
      actorId: ctx.user.id,
      action: "user.verification_resent",
      entityType: "User",
      entityId: ctx.user.id,
      ip: getClientIp(req),
    },
  });

  return ok({
    sent: true,
    message: "A new verification email has been sent.",
    ...(devExposeTokens() ? { devVerificationUrl: `/verify-email?token=${token}` } : {}),
  });
});
