import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validation";
import { ROLES, isAtLeastRole } from "@/lib/constants";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessionsForUser } from "@/lib/auth-core";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.ADMIN);
  const { id } = await ctx.params;
  const input = await readJson(req, userUpdateSchema);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("User not found.");

  // Role escalation guard: granting or removing staff roles requires a
  // super administrator. Administrators cannot modify super administrators.
  const isRoleChange = input.role !== undefined && input.role !== target.role;
  if (isRoleChange && input.role !== "STUDENT") {
    if (!isAtLeastRole(auth.user.role, ROLES.SUPER_ADMIN)) {
      throw forbidden("Only a super administrator can grant staff roles.");
    }
  }
  if (isRoleChange && (target.role === "ADMIN" || target.role === "SUPER_ADMIN")) {
    if (!isAtLeastRole(auth.user.role, ROLES.SUPER_ADMIN)) {
      throw forbidden("Only a super administrator can change administrator roles.");
    }
  }
  if (target.id === auth.user.id && input.status && input.status !== "ACTIVE") {
    throw unprocessable("You cannot suspend your own account.", "SELF_SUSPEND");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });

  // Suspension and role changes invalidate all existing sessions immediately.
  if (input.status === "SUSPENDED" || isRoleChange) {
    await revokeAllSessionsForUser(id);
  }

  await writeAudit({
    actorId: auth.user.id,
    action: "user.updated_by_admin",
    entityType: "User",
    entityId: id,
    before: { role: target.role, status: target.status },
    after: { role: updated.role, status: updated.status },
  });

  return ok({ id: updated.id, role: updated.role, status: updated.status });
});
