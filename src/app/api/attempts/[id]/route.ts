import { getClientIp, handle, ok, requireAuth } from "@/lib/api";
import { loadAttemptForStudent } from "@/lib/attempt-service";
import { buildAttemptStateView } from "@/lib/attempt-view";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const { attempt, exam } = await loadAttemptForStudent(id, auth.user.id, auth.sessionId, {
    forWrite: false,
    ip: getClientIp(req),
  });
  const view = await buildAttemptStateView(attempt, exam);
  return ok(view);
});
