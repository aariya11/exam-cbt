import { assertSameOrigin, getClientIp, handle, ok, requireAuth } from "@/lib/api";
import { finalizeAttempt, loadAttemptForStudent } from "@/lib/attempt-service";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

// Submission is idempotent: repeated or concurrent calls return the same
// result and never create a second score. The server decides whether this is a
// student submission or a deadline auto-submission using its own clock.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const ip = getClientIp(req);
  enforceRateLimit(`submit:${auth.user.id}`, 10, 60 * 1000);

  const { attempt, exam } = await loadAttemptForStudent(id, auth.user.id, auth.sessionId, {
    forWrite: false,
    ip,
  });

  if (attempt.status !== "IN_PROGRESS") {
    const result = await prisma.result.findUnique({ where: { attemptId: attempt.id } });
    return ok({
      alreadyFinalized: true,
      resultId: result?.id ?? null,
      published: Boolean(result?.publishedAt),
      status: attempt.status,
      finalizeReason: attempt.finalizeReason,
    });
  }

  const reason = Date.now() > attempt.deadlineAt.getTime() + Number(process.env.DEADLINE_GRACE_SECONDS ?? "2") * 1000
    ? "deadline_exceeded"
    : "student_submit";

  const outcome = await finalizeAttempt(attempt.id, reason);

  // Re-read after finalisation: the attempt object above was loaded before the
  // grade ran, so its status is stale by now.
  const fresh = await prisma.attempt.findUniqueOrThrow({
    where: { id: attempt.id },
    select: { status: true, result: { select: { publishedAt: true } } },
  });

  return ok({
    alreadyFinalized: outcome.alreadyFinalized,
    resultId: outcome.resultId,
    published: Boolean(fresh.result?.publishedAt),
    status: fresh.status,
    examTitle: exam.title,
  });
});
