import { prisma } from "@/lib/db";
import { assertSameOrigin, created, getClientIp, handle, readJson, requireAuth } from "@/lib/api";
import { startAttemptSchema } from "@/lib/validation";
import { assertEmailVerified } from "@/lib/auth-core";
import { startOrResumeAttempt } from "@/lib/attempt-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { notFound } from "@/lib/errors";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = await requireAuth(req);
  assertEmailVerified(ctx.user);
  const ip = getClientIp(req);
  enforceRateLimit(`attempt-start:${ctx.user.id}`, 20, 10 * 60 * 1000);

  const { examId } = await readJson(req, startAttemptSchema);
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!exam) throw notFound("Examination not found.");

  const { attempt, resumed } = await startOrResumeAttempt(exam, {
    userId: ctx.user.id,
    sessionId: ctx.sessionId,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return created({
    attemptId: attempt.id,
    resumed,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    serverTime: new Date().toISOString(),
  });
});
