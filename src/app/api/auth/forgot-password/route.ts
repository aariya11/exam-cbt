import { prisma } from "@/lib/db";
import { assertSameOrigin, getClientIp, handle, ok, readJson } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { devExposeTokens, issuePasswordResetToken } from "@/lib/auth-core";
import { enforceRateLimit } from "@/lib/rate-limit";
import { buildPasswordResetEmail, sendMail } from "@/lib/mail";

// Always returns the same response, whether or not the account exists, to
// avoid leaking which emails are registered.
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ip = getClientIp(req);
  enforceRateLimit(`forgot:ip:${ip ?? "unknown"}`, 10, 60 * 60 * 1000);

  const { email } = await readJson(req, forgotPasswordSchema);
  const normalized = email.trim().toLowerCase();
  enforceRateLimit(`forgot:email:${normalized}`, 3, 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  let devResetUrl: string | undefined;

  if (user && user.status === "ACTIVE") {
    const token = await issuePasswordResetToken(user.id);
    await sendMail(buildPasswordResetEmail(user.email, token, user.displayName));
    if (devExposeTokens()) {
      devResetUrl = `/reset-password?token=${token}`;
    }
  }

  return ok({
    submitted: true,
    message: "If an account exists for that email address, a reset link has been sent.",
    ...(devResetUrl ? { devResetUrl } : {}),
  });
});
