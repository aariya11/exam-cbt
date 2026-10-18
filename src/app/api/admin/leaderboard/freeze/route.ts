import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { getLeaderboard, periodBounds, type LeaderboardPeriod } from "@/lib/leaderboard";
import { parseTieBreakRules } from "@/lib/ranking";
import { writeAudit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

// Freeze a leaderboard window into RankingSnapshot rows. Snapshots make rank
// movement reporting possible without rescanning history on every page view.
const schema = z.object({
  examId: z.string().min(1),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.ADMIN);
  const input = await readJson(req, schema);

  const exam = await prisma.exam.findUnique({ where: { id: input.examId } });
  if (!exam) throw badRequest("Examination not found.");

  const period = input.period as LeaderboardPeriod;
  const bounds = periodBounds(period);
  if (!bounds.from) throw badRequest("A period is required.");

  const board = await getLeaderboard({
    scope: "EXAM",
    examId: exam.id,
    period,
    page: 1,
    pageSize: 50,
    tieBreakRules: parseTieBreakRules(exam.tieBreakRules),
  });

  const periodEnd = bounds.to ?? new Date();
  await prisma.rankingSnapshot.deleteMany({
    where: { scope: "EXAM", scopeKey: exam.id, periodStart: bounds.from },
  });
  for (const entry of board.entries) {
    await prisma.rankingSnapshot.create({
      data: {
        scope: "EXAM",
        scopeKey: exam.id,
        userId: entry.userId,
        rank: entry.rank,
        score: entry.score,
        periodStart: bounds.from,
        periodEnd,
      },
    });
  }

  await writeAudit({
    actorId: auth.user.id,
    action: "leaderboard.frozen",
    entityType: "Exam",
    entityId: exam.id,
    after: { period, entries: board.entries.length, periodStart: bounds.from.toISOString() },
  });

  return ok({ frozen: board.entries.length, period, periodStart: bounds.from.toISOString() });
});
