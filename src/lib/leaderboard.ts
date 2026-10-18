import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { badRequest } from "./errors";
import { parseTieBreakRules, type TieBreakRule } from "./ranking";

// Leaderboard engine.
//
// Ranking is computed in SQL with RANK() OVER (ORDER BY ...) so that equal
// participants share a rank exactly as the published policy describes, and no
// full result set is ever loaded into memory. The ORDER BY clause is built from
// whitelisted rule fragments only - no user input reaches the SQL text.
//
// Cohort definition:
//  - Only published results on non-invalidated attempts are eligible.
//  - A participant appears once per scope: with their best eligible attempt for
//    examination-scoped boards, or their aggregate across eligible exams for
//    category / difficulty / series / subject boards.
//  - Aggregated boards rank on percentage (documented as average of best
//    percentages, or total-score percentage, depending on the series formula).

export type LeaderboardScope = "EXAM" | "CATEGORY" | "DIFFICULTY" | "SERIES" | "SUBJECT";
export type LeaderboardPeriod = "ALL" | "DAILY" | "WEEKLY" | "MONTHLY";

export type LeaderboardQuery = {
  scope: LeaderboardScope;
  examId?: string | null;
  categoryId?: string | null;
  difficulty?: string | null;
  seriesId?: string | null;
  subjectId?: string | null;
  state?: string | null;
  search?: string | null;
  period?: LeaderboardPeriod;
  page?: number;
  pageSize?: number;
  tieBreakRules?: TieBreakRule[];
};

export type LeaderboardEntry = {
  rank: number;
  tied: boolean;
  userId: string;
  username: string;
  displayName: string;
  state: string | null;
  isDemo: boolean;
  score: number;
  maxScore: number | null;
  percentage: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  attempted: number;
  timeUsedSec: number;
  examCount: number;
  totalScore: number | null;
  totalMaxScore: number | null;
  lastAttemptAt: string | null;
};

export type LeaderboardResult = {
  scope: LeaderboardScope;
  period: LeaderboardPeriod;
  tieBreakRules: TieBreakRule[];
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
};

export type PeriodBounds = { from: Date | null; to: Date | null };

export function periodBounds(period: LeaderboardPeriod, now = new Date()): PeriodBounds {
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  switch (period) {
    case "DAILY": {
      const from = startOfDay(now);
      return { from, to: null };
    }
    case "WEEKLY": {
      const day = now.getUTCDay(); // 0 = Sunday
      const diff = (day + 6) % 7; // days since Monday
      const from = startOfDay(now);
      from.setUTCDate(from.getUTCDate() - diff);
      return { from, to: null };
    }
    case "MONTHLY": {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from, to: null };
    }
    default:
      return { from: null, to: null };
  }
}

const countExpr = Prisma.sql`CAST(COUNT(*) AS INTEGER)`;

function filterFragments(q: LeaderboardQuery): Prisma.Sql[] {
  const filters: Prisma.Sql[] = [
    Prisma.sql`r.publishedAt IS NOT NULL`,
    Prisma.sql`a.status IN ('SUBMITTED','AUTO_SUBMITTED')`,
    Prisma.sql`a.invalidatedAt IS NULL`,
    // Participants who opted out of public leaderboards are excluded entirely.
    Prisma.sql`u.leaderboardOptOut = FALSE`,
  ];
  if (q.examId) filters.push(Prisma.sql`r.examId = ${q.examId}`);
  if (q.categoryId) filters.push(Prisma.sql`e.categoryId = ${q.categoryId}`);
  if (q.difficulty) filters.push(Prisma.sql`e.difficulty = ${q.difficulty}`);
  if (q.seriesId) filters.push(Prisma.sql`e.seriesId = ${q.seriesId}`);
  const bounds = periodBounds(q.period ?? "ALL");
  if (bounds.from) filters.push(Prisma.sql`r.createdAt >= ${bounds.from}`);
  if (bounds.to) filters.push(Prisma.sql`r.createdAt <= ${bounds.to}`);
  if (q.state) filters.push(Prisma.sql`u.state = ${q.state}`);
  if (q.search) {
    const needle = `%${q.search.toLowerCase()}%`;
    filters.push(Prisma.sql`(LOWER(u.username) LIKE ${needle} OR LOWER(u.displayName) LIKE ${needle})`);
  }
  return filters;
}

const joinFilters = (filters: Prisma.Sql[]) =>
  filters.reduce((acc, fragment, index) => (index === 0 ? fragment : Prisma.sql`${acc} AND ${fragment}`), Prisma.empty);

// ORDER BY fragments from whitelisted tie-break rules.
function orderFragments(rules: TieBreakRule[], exprs: {
  primary: Prisma.Sql;
  accuracy: Prisma.Sql;
  wrong: Prisma.Sql;
  attempted: Prisma.Sql;
  time: Prisma.Sql;
}): Prisma.Sql[] {
  const parts: Prisma.Sql[] = [Prisma.sql`${exprs.primary} DESC`];
  for (const rule of rules) {
    switch (rule) {
      case "ACCURACY_DESC":
        parts.push(Prisma.sql`${exprs.accuracy} DESC`);
        break;
      case "WRONG_ASC":
        parts.push(Prisma.sql`${exprs.wrong} ASC`);
        break;
      case "ATTEMPTED_DESC":
        parts.push(Prisma.sql`${exprs.attempted} DESC`);
        break;
      case "TIME_ASC":
        parts.push(Prisma.sql`${exprs.time} ASC`);
        break;
    }
  }
  return parts;
}

const joinOrder = (parts: Prisma.Sql[]) =>
  parts.reduce((acc, fragment, index) => (index === 0 ? fragment : Prisma.sql`${acc}, ${fragment}`), Prisma.empty);

type RawRow = Record<string, unknown>;

// SQLite returns INTEGER columns as BigInt through Prisma raw queries, while
// PostgreSQL returns numbers. Normalise both to number here.
const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
};
const str = (value: unknown): string => (value === null || value === undefined ? "" : String(value));
const dateIso = (value: unknown): string | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

async function queryExamScope(q: LeaderboardQuery, tieBreak: TieBreakRule[], page: number, pageSize: number): Promise<LeaderboardResult> {
  const filters = joinFilters(filterFragments(q));
  const base = Prisma.sql`
    WITH best AS (
      SELECT r.userId AS userid, r.score AS score, r.maxScore AS maxscore, r.percentage AS percentage,
             r.accuracy AS accuracy, r.correctCount AS correctcount, r.wrongCount AS wrongcount,
             r.timeUsedSec AS timeusedsec, (r.correctCount + r.wrongCount) AS attempted,
             r.createdAt AS createdat,
             ROW_NUMBER() OVER (PARTITION BY r.userId ORDER BY r.score DESC, r.accuracy DESC, r.createdAt ASC) AS rn
      FROM "Result" r
      JOIN "Attempt" a ON a.id = r.attemptId
      JOIN "User" u ON u.id = r.userId
      JOIN "Exam" e ON e.id = r.examId
      WHERE ${filters}
    )`;

  const order = orderFragments(tieBreak, {
    primary: Prisma.sql`s.score`,
    accuracy: Prisma.sql`s.accuracy`,
    wrong: Prisma.sql`s.wrongcount`,
    attempted: Prisma.sql`s.attempted`,
    time: Prisma.sql`s.timeusedsec`,
  });

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    ${base}
    SELECT s.userid, s.score, s.maxscore, s.percentage, s.accuracy, s.correctcount, s.wrongcount,
           s.attempted, s.timeusedsec, s.createdat, 1 AS examcount,
           u.username, u.displayName AS displayname, u.state, u.isDemo AS isdemo,
           RANK() OVER (ORDER BY ${joinOrder(order)}) AS rankvalue
    FROM best s
    JOIN "User" u ON u.id = s.userid
    WHERE s.rn = 1
    ORDER BY rankvalue ASC, s.userid ASC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);

  const totalRows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    ${base}
    SELECT ${countExpr} AS total FROM best s WHERE s.rn = 1
  `);

  return {
    scope: "EXAM",
    period: q.period ?? "ALL",
    tieBreakRules: tieBreak,
    entries: rows.map((row) => mapEntry(row)),
    total: num(totalRows[0]?.total),
    page,
    pageSize,
    generatedAt: new Date().toISOString(),
  };
}

async function queryAggregateScope(q: LeaderboardQuery, tieBreak: TieBreakRule[], page: number, pageSize: number, formula: "TOTAL_SCORE" | "SUM_OF_BEST_PERCENTAGE"): Promise<LeaderboardResult> {
  const filters = joinFilters(filterFragments(q));
  const base = Prisma.sql`
    WITH best AS (
      SELECT r.userId AS userid, r.examId AS examid, r.score AS score, r.maxScore AS maxscore,
             r.percentage AS percentage, r.correctCount AS correctcount, r.wrongCount AS wrongcount,
             r.timeUsedSec AS timeusedsec, r.createdAt AS createdat,
             ROW_NUMBER() OVER (PARTITION BY r.userId, r.examId ORDER BY r.score DESC, r.accuracy DESC, r.createdAt ASC) AS rn
      FROM "Result" r
      JOIN "Attempt" a ON a.id = r.attemptId
      JOIN "User" u ON u.id = r.userId
      JOIN "Exam" e ON e.id = r.examId
      WHERE ${filters}
    ),
    agg AS (
      SELECT userid,
             CAST(SUM(score) AS DOUBLE PRECISION) AS totalscore,
             CAST(SUM(maxscore) AS DOUBLE PRECISION) AS totalmax,
             CAST(SUM(percentage) AS DOUBLE PRECISION) AS totalpercentage,
             CAST(SUM(correctcount) AS DOUBLE PRECISION) AS totalcorrect,
             CAST(SUM(wrongcount) AS DOUBLE PRECISION) AS totalwrong,
             CAST(SUM(timeusedsec) AS DOUBLE PRECISION) AS totaltime,
             CAST(COUNT(*) AS INTEGER) AS examcount,
             MAX(createdat) AS lastat
      FROM best WHERE rn = 1 GROUP BY userid
    )`;

  const primary = formula === "TOTAL_SCORE"
    ? Prisma.sql`(a.totalscore / NULLIF(a.totalmax, 0) * 100.0)`
    : Prisma.sql`(a.totalpercentage / NULLIF(a.examcount, 0))`;
  const accuracy = Prisma.sql`(a.totalcorrect / NULLIF(a.totalcorrect + a.totalwrong, 0) * 100.0)`;
  const attempted = Prisma.sql`(a.totalcorrect + a.totalwrong)`;

  const order = orderFragments(tieBreak, {
    primary,
    accuracy,
    wrong: Prisma.sql`a.totalwrong`,
    attempted,
    time: Prisma.sql`a.totaltime`,
  });

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    ${base}
    SELECT a.userid, ${primary} AS score, ${primary} AS percentage, a.totalscore, a.totalmax,
           ${accuracy} AS accuracy, a.totalcorrect, a.totalwrong,
           ${attempted} AS attempted, a.totaltime AS timeusedsec, a.examcount, a.lastat AS createdat,
           u.username, u.displayName AS displayname, u.state, u.isDemo AS isdemo,
           RANK() OVER (ORDER BY ${joinOrder(order)}) AS rankvalue
    FROM agg a
    JOIN "User" u ON u.id = a.userid
    ORDER BY rankvalue ASC, a.userid ASC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);

  const totalRows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`${base} SELECT ${countExpr} AS total FROM agg`);

  return {
    scope: q.scope,
    period: q.period ?? "ALL",
    tieBreakRules: tieBreak,
    entries: rows.map((row) => mapEntry(row)),
    total: num(totalRows[0]?.total),
    page,
    pageSize,
    generatedAt: new Date().toISOString(),
  };
}

async function querySubjectScope(q: LeaderboardQuery, tieBreak: TieBreakRule[], page: number, pageSize: number): Promise<LeaderboardResult> {
  if (!q.subjectId) throw badRequest("subjectId is required for subject leaderboards.");
  const filters = filterFragments(q);
  filters.push(Prisma.sql`ss.subjectId = ${q.subjectId}`);
  const where = joinFilters(filters);

  const base = Prisma.sql`
    WITH best AS (
      SELECT r.userId AS userid, r.examId AS examid, ss.score AS score, ss.maxScore AS maxscore,
             ss.correct AS correctcount, ss.wrong AS wrongcount, r.timeUsedSec AS timeusedsec,
             r.createdAt AS createdat,
             ROW_NUMBER() OVER (PARTITION BY r.userId, r.examId ORDER BY ss.score DESC, ss.correct DESC, ss.wrong ASC) AS rn
      FROM "ResultSubjectScore" ss
      JOIN "Result" r ON r.id = ss.resultId
      JOIN "Attempt" a ON a.id = r.attemptId
      JOIN "User" u ON u.id = r.userId
      JOIN "Exam" e ON e.id = r.examId
      WHERE ${where}
    ),
    agg AS (
      SELECT userid,
             CAST(SUM(score) AS DOUBLE PRECISION) AS totalscore,
             CAST(SUM(maxscore) AS DOUBLE PRECISION) AS totalmax,
             CAST(SUM(correctcount) AS DOUBLE PRECISION) AS totalcorrect,
             CAST(SUM(wrongcount) AS DOUBLE PRECISION) AS totalwrong,
             CAST(SUM(timeusedsec) AS DOUBLE PRECISION) AS totaltime,
             CAST(COUNT(*) AS INTEGER) AS examcount,
             MAX(createdat) AS lastat
      FROM best WHERE rn = 1 GROUP BY userid
    )`;

  const primary = Prisma.sql`(a.totalscore / NULLIF(a.totalmax, 0) * 100.0)`;
  const accuracy = Prisma.sql`(a.totalcorrect / NULLIF(a.totalcorrect + a.totalwrong, 0) * 100.0)`;
  const order = orderFragments(tieBreak, {
    primary,
    accuracy,
    wrong: Prisma.sql`a.totalwrong`,
    attempted: Prisma.sql`(a.totalcorrect + a.totalwrong)`,
    time: Prisma.sql`a.totaltime`,
  });

  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    ${base}
    SELECT a.userid, ${primary} AS score, ${primary} AS percentage, a.totalscore, a.totalmax,
           ${accuracy} AS accuracy,
           a.totalcorrect, a.totalwrong, (a.totalcorrect + a.totalwrong) AS attempted,
           a.totaltime AS timeusedsec, a.examcount, a.lastat AS createdat,
           u.username, u.displayName AS displayname, u.state, u.isDemo AS isdemo,
           RANK() OVER (ORDER BY ${joinOrder(order)}) AS rankvalue
    FROM agg a
    JOIN "User" u ON u.id = a.userid
    ORDER BY rankvalue ASC, a.userid ASC
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `);

  const totalRows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`${base} SELECT ${countExpr} AS total FROM agg`);

  return {
    scope: "SUBJECT",
    period: q.period ?? "ALL",
    tieBreakRules: tieBreak,
    entries: rows.map((row) => mapEntry(row)),
    total: num(totalRows[0]?.total),
    page,
    pageSize,
    generatedAt: new Date().toISOString(),
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function mapEntry(row: RawRow): LeaderboardEntry {
  return {
    rank: Math.round(num(row.rankvalue)),
    tied: false, // computed by markTies
    userId: str(row.userid),
    username: str(row.username),
    displayName: str(row.displayname),
    state: row.state ? String(row.state) : null,
    isDemo: Boolean(row.isdemo),
    score: round2(num(row.score)),
    maxScore: row.maxscore === null || row.maxscore === undefined ? null : round2(num(row.maxscore)),
    percentage: round2(num(row.percentage)),
    accuracy: round2(num(row.accuracy)),
    correctCount: Math.round(num(row.totalcorrect ?? row.correctcount)),
    wrongCount: Math.round(num(row.totalwrong ?? row.wrongcount)),
    attempted: Math.round(num(row.attempted)),
    timeUsedSec: Math.round(num(row.timeusedsec)),
    examCount: Math.max(1, Math.round(num(row.examcount))),
    totalScore: row.totalscore === undefined || row.totalscore === null ? null : round2(num(row.totalscore)),
    totalMaxScore: row.totalmax === undefined || row.totalmax === null ? null : round2(num(row.totalmax)),
    lastAttemptAt: dateIso(row.createdat),
  };
}

function markTies(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((entry, index) => {
    const prev = entries[index - 1];
    const next = entries[index + 1];
    const tied = (prev && prev.rank === entry.rank) || (next && next.rank === entry.rank) || false;
    return { ...entry, tied };
  });
}

export async function getLeaderboard(q: LeaderboardQuery): Promise<LeaderboardResult> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, q.pageSize ?? 25));
  const tieBreak = q.tieBreakRules ?? [];

  let result: LeaderboardResult;
  if (q.scope === "EXAM") {
    if (!q.examId) throw badRequest("examId is required for examination leaderboards.");
    result = await queryExamScope(q, tieBreak, page, pageSize);
  } else if (q.scope === "SUBJECT") {
    result = await querySubjectScope(q, tieBreak, page, pageSize);
  } else {
    let formula: "TOTAL_SCORE" | "SUM_OF_BEST_PERCENTAGE" = "TOTAL_SCORE";
    if (q.scope === "SERIES" && q.seriesId) {
      const series = await prisma.examSeries.findUnique({ where: { id: q.seriesId } });
      formula = series?.formula === "SUM_OF_BEST_PERCENTAGE" ? "SUM_OF_BEST_PERCENTAGE" : "TOTAL_SCORE";
    }
    result = await queryAggregateScope(q, tieBreak, page, pageSize, formula);
  }

  result.entries = markTies(result.entries);
  return result;
}

// ------------------------------------------------------------------
// Per-student rank summary (dashboard): current rank plus movement versus the
// rank position at the time of the student's latest published result.
// ------------------------------------------------------------------

export type UserRankSummary = {
  examId: string;
  examSlug: string;
  examTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  rank: number | null;
  participants: number;
  movement: number | null;
  latestPublishedAt: string | null;
};

export async function getUserRankSummaries(userId: string, limit = 5): Promise<UserRankSummary[]> {
  const results = await prisma.result.findMany({
    where: { userId, publishedAt: { not: null }, attempt: { invalidatedAt: null, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } },
    include: { attempt: { include: { exam: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const byExam = new Map<string, (typeof results)[number]>();
  for (const result of results) {
    const existing = byExam.get(result.examId);
    if (!existing || result.score > existing.score) byExam.set(result.examId, result);
  }

  const summaries: UserRankSummary[] = [];
  for (const result of [...byExam.values()].slice(0, limit)) {
    const exam = result.attempt.exam;
    const participants = await prisma.result.count({ where: { examId: exam.id, publishedAt: { not: null } } });
    const better = await prisma.result.count({
      where: { examId: exam.id, publishedAt: { not: null }, score: { gt: result.score } },
    });
    const rank = better + 1;

    const historicalBetterRows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT ${countExpr} AS c FROM (
        SELECT MAX(r.score) AS bestscore
        FROM "Result" r
        JOIN "Attempt" a ON a.id = r.attemptId
        WHERE r.examId = ${exam.id} AND r.publishedAt IS NOT NULL
          AND a.status IN ('SUBMITTED','AUTO_SUBMITTED') AND a.invalidatedAt IS NULL
          AND r.createdAt < ${result.createdAt} AND r.userId <> ${userId}
        GROUP BY r.userId
      ) t WHERE t.bestscore > ${result.score}
    `);
    const historicalRank = num(historicalBetterRows[0]?.c) + 1;

    summaries.push({
      examId: exam.id,
      examSlug: exam.slug,
      examTitle: exam.title,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      rank,
      participants,
      movement: historicalRank - rank,
      latestPublishedAt: result.publishedAt?.toISOString() ?? null,
    });
  }
  return summaries;
}

export async function getExamParticipationStats(examIds: string[]): Promise<
  Map<string, { participants: number; averagePercentage: number }>
> {
  if (examIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT r.examId AS examid, CAST(COUNT(DISTINCT r.userId) AS INTEGER) AS participants,
           CAST(AVG(r.percentage) AS DOUBLE PRECISION) AS avgpct
    FROM "Result" r
    JOIN "Attempt" a ON a.id = r.attemptId
    WHERE r.examId IN (${Prisma.join(examIds)}) AND r.publishedAt IS NOT NULL
      AND a.status IN ('SUBMITTED','AUTO_SUBMITTED') AND a.invalidatedAt IS NULL
    GROUP BY r.examId
  `);
  const map = new Map<string, { participants: number; averagePercentage: number }>();
  for (const row of rows) {
    map.set(str(row.examid), {
      participants: num(row.participants),
      averagePercentage: Math.round(num(row.avgpct) * 10) / 10,
    });
  }
  return map;
}

export function leaderboardSummaryText(q: LeaderboardQuery, total: number): string {
  const period = periodBounds(q.period ?? "ALL");
  const periodLabel =
    q.period === "DAILY" ? "today (UTC)" : q.period === "WEEKLY" ? "this week (UTC)" : q.period === "MONTHLY" ? "this month (UTC)" : "all time";
  const scopeLabel =
    q.scope === "EXAM" ? "this mock test" : q.scope === "CATEGORY" ? "this examination category" : q.scope === "SERIES" ? "this series" : q.scope === "SUBJECT" ? "this subject" : "this difficulty level";
  const filters = [q.state ? `state: ${q.state}` : null, q.search ? `search: "${q.search}"` : null].filter(Boolean).join(", ");
  return `${total} eligible participant(s) in ${scopeLabel}, ${periodLabel}${filters ? ` (${filters})` : ""}. ${period.from ? `Window from ${period.from.toISOString().slice(0, 10)}.` : ""}`.trim();
}

export { parseTieBreakRules };
