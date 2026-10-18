"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Label, Select, Skeleton, Table, Td, Th, cn } from "@/components/ui";
import { DIFFICULTIES, DIFFICULTY_LABELS, INDIA_STATES, RANKING_DISCLAIMER, type Difficulty } from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/format";
import { Trophy } from "lucide-react";

export type LeaderboardEntryDto = {
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

export type LeaderboardPayload = {
  scope: string;
  period: string;
  tieBreakRules: string[];
  entries: LeaderboardEntryDto[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  summary: string;
};

export type FilterOptions = {
  exams: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  series: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
};

export type LeaderboardFilters = {
  scope: string;
  examId: string;
  categoryId: string;
  difficulty: string;
  seriesId: string;
  subjectId: string;
  period: string;
  state: string;
  search: string;
  page: number;
};

const scopes = [
  { value: "EXAM", label: "Single mock test" },
  { value: "CATEGORY", label: "Examination category" },
  { value: "DIFFICULTY", label: "Difficulty level" },
  { value: "SERIES", label: "Test series" },
  { value: "SUBJECT", label: "Subject" },
];

const periods = [
  { value: "ALL", label: "All time" },
  { value: "DAILY", label: "Today (UTC)" },
  { value: "WEEKLY", label: "This week (UTC)" },
  { value: "MONTHLY", label: "This month (UTC)" },
];

const ruleLabels: Record<string, string> = {
  ACCURACY_DESC: "higher accuracy first",
  WRONG_ASC: "fewer incorrect answers first",
  ATTEMPTED_DESC: "more questions attempted first",
  TIME_ASC: "less time used first",
};

function toQuery(filters: LeaderboardFilters) {
  const params = new URLSearchParams();
  params.set("scope", filters.scope);
  params.set("period", filters.period);
  if (filters.scope === "EXAM" && filters.examId) params.set("examId", filters.examId);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.seriesId) params.set("seriesId", filters.seriesId);
  if (filters.subjectId) params.set("subjectId", filters.subjectId);
  if (filters.state) params.set("state", filters.state);
  if (filters.search) params.set("search", filters.search);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function LeaderboardExplorer({
  initial,
  options,
  initialFilters,
}: {
  initial: LeaderboardPayload;
  options: FilterOptions;
  initialFilters: LeaderboardFilters;
}) {
  const [filters, setFilters] = useState<LeaderboardFilters>(initialFilters);
  const [payload, setPayload] = useState<LeaderboardPayload>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const update = useCallback((patch: Partial<LeaderboardFilters>) => {
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/leaderboards?${toQuery(filters)}`, { signal: controller.signal });
        const body = (await response.json()) as LeaderboardPayload & { error?: { message: string } };
        if (!response.ok || !Array.isArray(body.entries)) {
          setError(body.error?.message ?? "Could not load this leaderboard.");
          return;
        }
        setPayload(body);
        const query = toQuery(filters);
        window.history.replaceState(null, "", query ? `/leaderboards?${query}` : "/leaderboards");
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") setError("Network problem while loading the leaderboard.");
      } finally {
        setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [filters]);

  const scopeNeeds = useMemo(
    () => ({
      exam: filters.scope === "EXAM",
      series: filters.scope === "SERIES",
      subject: filters.scope === "SUBJECT",
      aggregates: ["CATEGORY", "DIFFICULTY", "SERIES", "SUBJECT"].includes(filters.scope),
    }),
    [filters.scope],
  );

  const ruleText = payload.tieBreakRules
    .map((rule) => ruleLabels[rule] ?? rule)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-5">
        <Card>
          <CardHeader title="Filters" />
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="lb-scope">Leaderboard</Label>
              <Select id="lb-scope" value={filters.scope} onChange={(event) => {
                const scope = event.target.value;
                const patch: Partial<LeaderboardFilters> = { scope };
                if (scope !== "EXAM") patch.examId = "";
                if (scope === "EXAM") patch.examId = filters.examId || options.exams[0]?.id || "";
                update(patch);
              }}>
                {scopes.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </Select>
            </div>

            {scopeNeeds.exam ? (
              <div>
                <Label htmlFor="lb-exam">Mock test</Label>
                <Select id="lb-exam" value={filters.examId} onChange={(event) => update({ examId: event.target.value })}>
                  {options.exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {scopeNeeds.series ? (
              <div>
                <Label htmlFor="lb-series">Series</Label>
                <Select id="lb-series" value={filters.seriesId} onChange={(event) => update({ seriesId: event.target.value })}>
                  <option value="">Select a series</option>
                  {options.series.map((series) => (
                    <option key={series.id} value={series.id}>
                      {series.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {scopeNeeds.subject ? (
              <div>
                <Label htmlFor="lb-subject">Subject</Label>
                <Select id="lb-subject" value={filters.subjectId} onChange={(event) => update({ subjectId: event.target.value })}>
                  <option value="">Select a subject</option>
                  {options.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {scopeNeeds.aggregates ? (
              <div>
                <Label htmlFor="lb-category">Narrow to category</Label>
                <Select id="lb-category" value={filters.categoryId} onChange={(event) => update({ categoryId: event.target.value })}>
                  <option value="">All categories</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {scopeNeeds.aggregates ? (
              <div>
                <Label htmlFor="lb-difficulty">Difficulty</Label>
                <Select id="lb-difficulty" value={filters.difficulty} onChange={(event) => update({ difficulty: event.target.value })}>
                  <option value="">All difficulties</option>
                  {Object.values(DIFFICULTIES).map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {DIFFICULTY_LABELS[difficulty as Difficulty]}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div>
              <Label htmlFor="lb-period">Period</Label>
              <Select id="lb-period" value={filters.period} onChange={(event) => update({ period: event.target.value })}>
                {periods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="lb-state">State</Label>
              <Select id="lb-state" value={filters.state} onChange={(event) => update({ state: event.target.value })}>
                <option value="">All states</option>
                {INDIA_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="lb-search">Participant</Label>
              <Input
                id="lb-search"
                value={filters.search}
                placeholder="Search name or username"
                onChange={(event) => update({ search: event.target.value })}
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                setFilters({ scope: "EXAM", examId: options.exams[0]?.id ?? "", categoryId: "", difficulty: "", seriesId: "", subjectId: "", period: "ALL", state: "", search: "", page: 1 })
              }
            >
              Reset filters
            </Button>
          </CardBody>
        </Card>

        <div className="rounded-xl border border-ink-200 px-4 py-3.5 dark:border-ink-800">
          <p className="text-xs font-medium text-ink-700 dark:text-ink-200">Ranking policy</p>
          <p className="mt-1.5 text-xs leading-5 text-ink-500 dark:text-ink-400">
            Ranked by score (or percentage for aggregated boards)
            {ruleText ? `, then ${ruleText}` : ""}; equal participants share the same rank.
          </p>
          <p className="mt-2 text-[11px] leading-5 text-ink-400 dark:text-ink-500">{RANKING_DISCLAIMER}</p>
        </div>
      </aside>

      <section aria-live="polite">
        <Card>
          <CardHeader
            title={`${payload.total} participant${payload.total === 1 ? "" : "s"}`}
            description={payload.summary}
            action={
              loading ? <Skeleton className="h-5 w-20" /> : <Badge tone="brand">Updated {formatDateTime(payload.generatedAt)}</Badge>
            }
          />
          <CardBody className="px-0 py-0">
            {error ? (
              <p className="px-5 py-8 text-center text-sm text-danger-600 dark:text-danger-500">{error}</p>
            ) : payload.entries.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  icon={<Trophy className="h-8 w-8" aria-hidden />}
                  title="No ranked participants yet"
                  description="Results appear here once participants finish an eligible attempt and results are published."
                />
              </div>
            ) : (
              <>
                <Table className="min-w-[760px]">
                  <caption className="sr-only">{payload.summary}</caption>
                  <thead>
                    <tr>
                      <Th className="w-16">Rank</Th>
                      <Th>Participant</Th>
                      <Th>State</Th>
                      <Th className="text-right">Score</Th>
                      <Th className="text-right">{scopeNeeds.aggregates ? "Avg %" : "%"}</Th>
                      <Th className="text-right">Accuracy</Th>
                      <Th className="text-right">C / W</Th>
                      <Th className="text-right">Time</Th>
                      <Th className="text-right">{scopeNeeds.aggregates ? "Tests" : "Tied"}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.entries.map((entry) => (
                      <tr key={entry.userId} className={cn(entry.rank <= 3 && "bg-brand-50/40 dark:bg-brand-900/10")}>
                        <Td className="nums font-semibold">
                          #{entry.rank}
                          {entry.tied ? <span className="ml-1 text-[10px] font-normal text-ink-400">tie</span> : null}
                        </Td>
                        <Td>
                          <span className="block font-medium text-ink-900 dark:text-ink-100">{entry.displayName}</span>
                          <span className="block text-xs text-ink-400 dark:text-ink-500">@{entry.username}</span>
                        </Td>
                        <Td className="text-xs">{entry.state ?? "-"}</Td>
                        <Td className="nums text-right font-semibold">
                          {entry.totalScore !== null && entry.totalMaxScore !== null
                            ? `${entry.totalScore} / ${entry.totalMaxScore}`
                            : `${entry.score}${entry.maxScore !== null ? ` / ${entry.maxScore}` : ""}`}
                        </Td>
                        <Td className="nums text-right">{entry.percentage}%</Td>
                        <Td className="nums text-right">{entry.accuracy}%</Td>
                        <Td className="nums text-right text-xs">
                          {entry.correctCount} / {entry.wrongCount}
                        </Td>
                        <Td className="nums text-right text-xs">{formatDuration(entry.timeUsedSec)}</Td>
                        <Td className="nums text-right text-xs">
                          {scopeNeeds.aggregates ? entry.examCount : entry.tied ? "yes" : "-"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <p className="nums text-xs text-ink-500 dark:text-ink-400">
                    Page {payload.page} of {Math.max(1, Math.ceil(payload.total / payload.pageSize))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={payload.page <= 1 || loading}
                      onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={payload.page >= Math.ceil(payload.total / payload.pageSize) || loading}
                      onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 text-xs leading-5 text-ink-500 dark:text-ink-400">
          Want to appear here?{" "}
          <Link href="/mock-tests" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            Take a mock test
          </Link>{" "}
          - every submitted attempt is scored and ranked automatically.
        </p>
      </section>
    </div>
  );
}
