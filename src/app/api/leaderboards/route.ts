import { prisma } from "@/lib/db";
import { handle, ok, parsePagination } from "@/lib/api";
import { getLeaderboard, leaderboardSummaryText, type LeaderboardPeriod, type LeaderboardScope } from "@/lib/leaderboard";
import { parseTieBreakRules } from "@/lib/ranking";
import { badRequest } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";

const SCOPES: LeaderboardScope[] = ["EXAM", "CATEGORY", "DIFFICULTY", "SERIES", "SUBJECT"];
const PERIODS: LeaderboardPeriod[] = ["ALL", "DAILY", "WEEKLY", "MONTHLY"];

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  enforceRateLimit(`leaderboard:${getClientIp(req) ?? "unknown"}`, 120, 60 * 1000);

  const scope = (url.searchParams.get("scope") ?? "EXAM").toUpperCase() as LeaderboardScope;
  if (!SCOPES.includes(scope)) throw badRequest("Unknown leaderboard scope.");

  const period = (url.searchParams.get("period") ?? "ALL").toUpperCase() as LeaderboardPeriod;
  if (!PERIODS.includes(period)) throw badRequest("Unknown leaderboard period.");

  const { page, pageSize } = parsePagination(url, 25);

  const examId = url.searchParams.get("examId");
  const categoryId = url.searchParams.get("categoryId");
  const difficulty = url.searchParams.get("difficulty");
  const seriesId = url.searchParams.get("seriesId");
  const subjectId = url.searchParams.get("subjectId");
  const state = url.searchParams.get("state");
  const search = url.searchParams.get("search");

  // Tie-break rules come from the examination's published configuration. For
  // aggregated boards without a single examination, equal participants share a
  // rank (no implicit tie-break is invented).
  let tieBreakRules = [] as ReturnType<typeof parseTieBreakRules>;
  if (scope === "EXAM" && examId) {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { tieBreakRules: true } });
    if (!exam) throw badRequest("Examination not found.");
    tieBreakRules = parseTieBreakRules(exam.tieBreakRules);
  }

  const query = {
    scope,
    examId,
    categoryId,
    difficulty,
    seriesId,
    subjectId,
    state,
    search,
    period,
    page,
    pageSize,
    tieBreakRules,
  };

  const result = await getLeaderboard(query);

  return ok({
    ...result,
    summary: leaderboardSummaryText(query, result.total),
  });
});
