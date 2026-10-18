import { assertSameOrigin, getClientIp, handle, ok, readJson, requireAuth } from "@/lib/api";
import { saveAnswerSchema } from "@/lib/validation";
import { loadAttemptForStudent, saveAnswerState } from "@/lib/attempt-service";
import { parsePaper } from "@/lib/paper";
import { enforceRateLimit } from "@/lib/rate-limit";

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const ip = getClientIp(req);

  // Generous but bounded: a student cannot reasonably exceed this while
  // answering, yet automation is throttled.
  enforceRateLimit(`answer:${auth.user.id}`, 240, 60 * 1000);

  const input = await readJson(req, saveAnswerSchema);
  const { attempt } = await loadAttemptForStudent(id, auth.user.id, auth.sessionId, {
    forWrite: true,
    ip,
  });
  const paper = parsePaper(attempt.paperJson);
  await saveAnswerState(attempt, paper, auth.sessionId, input, ip);

  return ok({
    saved: true,
    questionId: input.questionId,
    serverTime: new Date().toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    status: attempt.status,
  });
});
