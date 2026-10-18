import { prisma } from "@/lib/db";
import { handle, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

// Results export. Public identifiers only - email addresses, IP data and other
// personal information are deliberately excluded from exports.
export const GET = handle(async (req: Request) => {
  const auth = await requireRole(req, ROLES.EXAM_MANAGER);
  const url = new URL(req.url);
  const examId = url.searchParams.get("examId");
  if (!examId) throw badRequest("examId is required.");

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw badRequest("Examination not found.");

  const results = await prisma.result.findMany({
    where: { examId, attempt: { invalidatedAt: null } },
    include: { user: { select: { username: true, displayName: true, state: true } } },
    orderBy: { score: "desc" },
  });

  const header = [
    "rank",
    "username",
    "display_name",
    "state",
    "score",
    "max_score",
    "percentage",
    "accuracy",
    "correct",
    "wrong",
    "unanswered",
    "time_used_sec",
    "published",
  ].join(",");

  const csvCell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = results.map((result, index) =>
    [
      result.rankSnapshot ?? index + 1,
      result.user.username,
      result.user.displayName,
      result.user.state ?? "",
      result.score,
      result.maxScore,
      result.percentage,
      result.accuracy,
      result.correctCount,
      result.wrongCount,
      result.unansweredCount,
      result.timeUsedSec,
      result.publishedAt ? "yes" : "no",
    ]
      .map(csvCell)
      .join(","),
  );

  await writeAudit({
    actorId: auth.user.id,
    action: "results.exported",
    entityType: "Exam",
    entityId: examId,
    after: { rows: results.length },
  });

  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rankforge-results-${exam.slug}.csv"`,
    },
  }) as unknown as import("next/server").NextResponse;
});
