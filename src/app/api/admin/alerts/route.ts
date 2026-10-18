import { prisma } from "@/lib/db";
import { handle, ok, parsePagination, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.EXAM_MANAGER);
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url, 25);
  const status = url.searchParams.get("status") ?? "OPEN";
  const severity = url.searchParams.get("severity");

  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(severity ? { severity } : {}),
  };

  const [total, alerts] = await Promise.all([
    prisma.integrityAlert.count({ where }),
    prisma.integrityAlert.findMany({
      where,
      include: {
        attempt: { select: { id: true, examId: true, exam: { select: { title: true } } } },
        user: { select: { id: true, username: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    alerts: alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      confidence: alert.confidence,
      detail: alert.detail,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
      attemptId: alert.attemptId,
      examTitle: alert.attempt?.exam.title ?? null,
      username: alert.user?.username ?? null,
      reviewedAt: alert.reviewedAt?.toISOString() ?? null,
      resolutionNote: alert.resolutionNote,
    })),
  });
});
