import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { attemptAdminSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { badRequest, notFound } from "@/lib/errors";
import { invalidateAttempt, releaseAttemptSession } from "@/lib/attempt-service";
import { regradeExam } from "@/lib/regrade";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole(req, ROLES.EXAM_MANAGER);
  const { id } = await ctx.params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, title: true } },
      user: { select: { id: true, username: true, displayName: true } },
      result: true,
      events: { orderBy: { serverTime: "asc" }, take: 500 },
    },
  });
  if (!attempt) throw notFound("Attempt not found.");

  return ok({
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    finalizeReason: attempt.finalizeReason,
    focusWarnings: attempt.focusWarnings,
    invalidatedReason: attempt.invalidatedReason,
    username: attempt.user.username,
    examTitle: attempt.exam.title,
    result: attempt.result
      ? {
          id: attempt.result.id,
          score: attempt.result.score,
          maxScore: attempt.result.maxScore,
          percentage: attempt.result.percentage,
          published: Boolean(attempt.result.publishedAt),
        }
      : null,
    timeline: attempt.events.map((event) => ({
      type: event.type,
      detail: event.detail,
      serverTime: event.serverTime.toISOString(),
      clientTime: event.clientTime?.toISOString() ?? null,
    })),
  });
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.ADMIN);
  const { id } = await ctx.params;
  const input = await readJson(req, attemptAdminSchema);

  const attempt = await prisma.attempt.findUnique({ where: { id }, include: { result: true } });
  if (!attempt) throw notFound("Attempt not found.");

  if (input.action === "INVALIDATE") {
    await invalidateAttempt(id, input.reason || "Invalidated by administrator", auth.user.id);
    return ok({ action: input.action, status: "INVALIDATED" });
  }

  if (input.action === "RELEASE_SESSION") {
    await releaseAttemptSession(id, auth.user.id);
    return ok({ action: input.action, sessionId: null });
  }

  if (input.action === "RECALCULATE") {
    const regrade = await regradeExam(attempt.examId, auth.user.id, input.reason || "Manual recalculation");
    return ok({ action: input.action, ...regrade });
  }

  throw badRequest("Unknown action.");
});
