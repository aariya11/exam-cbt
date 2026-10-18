import { assertSameOrigin, getClientIp, handle, ok, readJson, requireAuth } from "@/lib/api";
import { attemptEventSchema } from "@/lib/validation";
import { loadAttemptForStudent, recordAttemptEvent } from "@/lib/attempt-service";
import { enforceRateLimit } from "@/lib/rate-limit";

// Monitoring events (focus changes, fullscreen exits, reconnects) are recorded
// with server timestamps for integrity review. They are advisory signals and
// are never treated as automatic proof of misconduct.
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const ip = getClientIp(req);
  enforceRateLimit(`events:${auth.user.id}`, 60, 60 * 1000);

  const input = await readJson(req, attemptEventSchema);
  const { attempt } = await loadAttemptForStudent(id, auth.user.id, auth.sessionId, {
    forWrite: false,
    ip,
  });
  const result = await recordAttemptEvent(attempt, input.type, input.detail ?? {}, ip, input.clientTime ?? null);
  return ok({ recorded: true, focusWarnings: result.focusWarnings });
});
