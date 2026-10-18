import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { alertReviewSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

// Integrity alerts are reviewed by a human. Alerts are advisory signals with
// recorded evidence; resolving or dismissing one always records the reviewer
// and the note for the audit trail.
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.ADMIN);
  const { id } = await ctx.params;
  const input = await readJson(req, alertReviewSchema);

  const alert = await prisma.integrityAlert.findUnique({ where: { id } });
  if (!alert) throw notFound("Alert not found.");

  const status = input.action === "RESOLVE" ? "RESOLVED" : "DISMISSED";
  await prisma.integrityAlert.update({
    where: { id },
    data: {
      status,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
      resolutionNote: input.note ?? null,
    },
  });

  await writeAudit({
    actorId: auth.user.id,
    action: "integrity_alert.reviewed",
    entityType: "IntegrityAlert",
    entityId: id,
    before: { status: alert.status },
    after: { status, note: input.note ?? null },
  });

  return ok({ id, status });
});
