import { prisma } from "@/lib/db";
import { handle, ok, parsePagination, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.ADMIN);
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url, 30);
  const entityType = url.searchParams.get("entityType");
  const action = url.searchParams.get("action");

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { username: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actor: log.actor?.username ?? null,
      actorRole: log.actor?.role ?? null,
      before: log.before,
      after: log.after,
      ip: log.ip,
      createdAt: log.createdAt.toISOString(),
    })),
  });
});
