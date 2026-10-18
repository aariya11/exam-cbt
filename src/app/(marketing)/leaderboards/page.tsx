import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getLeaderboard, leaderboardSummaryText, type LeaderboardPeriod, type LeaderboardScope } from "@/lib/leaderboard";
import { parseTieBreakRules } from "@/lib/ranking";
import { badRequest } from "@/lib/errors";
import {
  LeaderboardExplorer,
  type FilterOptions,
  type LeaderboardFilters,
  type LeaderboardPayload,
} from "@/components/leaderboard/leaderboard-explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Practice rankings for RankForge mock tests, by mock test, category, difficulty, series or subject.",
};

const SCOPES = ["EXAM", "CATEGORY", "DIFFICULTY", "SERIES", "SUBJECT"];
const PERIODS = ["ALL", "DAILY", "WEEKLY", "MONTHLY"];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const single = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export default async function LeaderboardsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const [exams, categories, series, subjects] = await Promise.all([
    prisma.exam.findMany({
      where: { status: "ACTIVE" },
      orderBy: { title: "asc" },
      select: { id: true, title: true, tieBreakRules: true },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.examSeries.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const scope = SCOPES.includes(single(params.scope).toUpperCase()) ? single(params.scope).toUpperCase() : "EXAM";
  const period = PERIODS.includes(single(params.period).toUpperCase()) ? single(params.period).toUpperCase() : "ALL";
  const examId = single(params.examId) || exams[0]?.id || "";
  const categoryId = single(params.categoryId);
  const difficulty = single(params.difficulty);
  const seriesId = single(params.seriesId);
  const subjectId = single(params.subjectId);
  const state = single(params.state);
  const search = single(params.search);
  const page = Math.max(1, Number.parseInt(single(params.page) || "1", 10) || 1);

  const filters: LeaderboardFilters = {
    scope,
    examId,
    categoryId,
    difficulty,
    seriesId,
    subjectId,
    period,
    state,
    search,
    page,
  };

  const tieBreakRules =
    scope === "EXAM" && examId ? parseTieBreakRules(exams.find((exam) => exam.id === examId)?.tieBreakRules) : [];

  const query = {
    scope: scope as LeaderboardScope,
    examId: scope === "EXAM" ? examId : null,
    categoryId: categoryId || null,
    difficulty: difficulty || null,
    seriesId: seriesId || null,
    subjectId: subjectId || null,
    state: state || null,
    search: search || null,
    period: period as LeaderboardPeriod,
    page,
    pageSize: 25,
    tieBreakRules,
  };

  if (query.scope === "SUBJECT" && !query.subjectId) throw badRequest("Choose a subject to view its leaderboard.");
  if (query.scope === "SERIES" && !query.seriesId) throw badRequest("Choose a series to view its leaderboard.");

  const board = await getLeaderboard(query);
  const payload: LeaderboardPayload = {
    ...board,
    summary: leaderboardSummaryText(query, board.total),
  };

  const options: FilterOptions = {
    exams: exams.map((exam) => ({ id: exam.id, title: exam.title })),
    categories,
    series,
    subjects,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Practice leaderboards</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          Rankings are computed from published results under each test&apos;s documented tie-break policy. Equal
          participants share the same rank. These are practice rankings among RankForge participants, not official
          examination results.
        </p>
      </header>
      <div className="mt-8">
        <LeaderboardExplorer initial={payload} options={options} initialFilters={filters} />
      </div>
    </div>
  );
}
