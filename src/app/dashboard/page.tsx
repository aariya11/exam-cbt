import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { getUserRankSummaries } from "@/lib/leaderboard";
import { ACHIEVEMENTS, ATTEMPT_STATUS, RANKING_DISCLAIMER } from "@/lib/constants";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Stat, Table, Td, Th } from "@/components/ui";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { ArrowRight, BookOpenCheck, Flame, Target, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [results, attemptCount, achievementRows, rankSummaries] = await Promise.all([
    prisma.result.findMany({
      where: { userId: user.id, attempt: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, invalidatedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { attempt: { include: { exam: { select: { title: true, slug: true } } } } },
    }),
    prisma.attempt.count({ where: { userId: user.id } }),
    prisma.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: true }, orderBy: { earnedAt: "desc" } }),
    getUserRankSummaries(user.id, 4),
  ]);

  const scored = results.filter((result) => result.maxScore > 0);
  const averagePercentage =
    scored.length > 0 ? scored.reduce((total, result) => total + result.percentage, 0) / scored.length : null;
  const bestResult = scored.reduce<(typeof scored)[number] | null>(
    (best, result) => (!best || result.percentage > best.percentage ? result : best),
    null,
  );
  const totalTimeSec = results.reduce((total, result) => total + result.timeUsedSec, 0);

  // Weakest topics across the most recent results, ranked by accuracy.
  const topicStats = new Map<string, { name: string; correct: number; total: number }>();
  for (const result of results.slice(0, 8)) {
    const topics = JSON.parse(result.topicBreakdown) as Array<{
      topicId: string;
      topicName: string;
      correct: number;
      partial: number;
      wrong: number;
      unanswered: number;
    }>;
    for (const topic of topics) {
      const entry = topicStats.get(topic.topicId) ?? { name: topic.topicName, correct: 0, total: 0 };
      entry.correct += topic.correct;
      entry.total += topic.correct + topic.partial + topic.wrong + topic.unanswered;
      topicStats.set(topic.topicId, entry);
    }
  }
  const weakTopics = [...topicStats.entries()]
    .filter(([, stats]) => stats.total >= 3)
    .map(([topicId, stats]) => ({ topicId, ...stats, accuracy: (stats.correct / stats.total) * 100 }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">
            Welcome back, {user.displayName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Here is where your preparation stands right now.
          </p>
        </div>
        <LinkButton href="/mock-tests" size="md">
          Take a mock test
        </LinkButton>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tests completed" value={attemptCount} icon={<BookOpenCheck className="h-4 w-4" aria-hidden />} />
        <Stat
          label="Average score"
          value={averagePercentage !== null ? formatPercent(averagePercentage) : "-"}
          hint={scored.length > 0 ? `across ${scored.length} scored attempt(s)` : "No scored attempts yet"}
          icon={<Target className="h-4 w-4" aria-hidden />}
        />
        <Stat
          label="Best score"
          value={bestResult ? formatPercent(bestResult.percentage) : "-"}
          hint={bestResult?.attempt.exam.title}
          icon={<Flame className="h-4 w-4" aria-hidden />}
        />
        <Stat
          label="Time under exam conditions"
          value={totalTimeSec > 0 ? formatDuration(totalTimeSec) : "-"}
          hint="Total time across recent attempts"
          icon={<Trophy className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recent attempts"
            description="Your latest scored mock tests"
            action={
              <Link href="/dashboard/attempts" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                View all
              </Link>
            }
          />
          {results.length === 0 ? (
            <CardBody>
              <EmptyState
                title="No attempts yet"
                description="Take your first mock test to see a scorecard, analytics and your practice rank here."
                action={<LinkButton href="/mock-tests" size="sm">Browse mock tests</LinkButton>}
              />
            </CardBody>
          ) : (
            <CardBody className="px-0 py-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Test</Th>
                    <Th className="text-right">Score</Th>
                    <Th className="text-right">Accuracy</Th>
                    <Th>When</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 6).map((result) => (
                    <tr key={result.id}>
                      <Td className="max-w-56 truncate font-medium text-ink-900 dark:text-ink-100">
                        {result.attempt.exam.title}
                      </Td>
                      <Td className="nums text-right">
                        {result.score} / {result.maxScore}
                        <span className="ml-1.5 text-xs text-ink-400">({formatPercent(result.percentage)})</span>
                      </Td>
                      <Td className="nums text-right">{formatPercent(result.accuracy)}</Td>
                      <Td className="nums text-xs">{formatDateTime(result.createdAt)}</Td>
                      <Td className="text-right">
                        <Link
                          href={`/attempt/${result.attemptId}/result`}
                          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                        >
                          Scorecard
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your ranks" description="Against published results on the same tests" />
            <CardBody className="space-y-3">
              {rankSummaries.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">
                  Ranks appear once your results are published on a test with other participants.
                </p>
              ) : (
                rankSummaries.map((summary) => (
                  <div key={summary.examId} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3.5 py-2.5 dark:border-ink-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{summary.examTitle}</p>
                      <p className="nums text-xs text-ink-500 dark:text-ink-400">
                        {formatPercent(summary.percentage)} · {summary.participants} participant(s)
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="nums text-lg font-semibold text-ink-950 dark:text-ink-50">#{summary.rank}</p>
                      {summary.movement !== null && summary.movement !== 0 ? (
                        <p className="nums text-[11px] text-ink-400">
                          {summary.movement > 0 ? `↑ ${summary.movement}` : `↓ ${Math.abs(summary.movement)}`} since publication
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <p className="text-[11px] leading-5 text-ink-400 dark:text-ink-500">{RANKING_DISCLAIMER}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Focus areas"
              description="Your weakest topics across recent attempts"
            />
            <CardBody className="space-y-2.5">
              {weakTopics.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">Not enough topic data yet - take a few more tests.</p>
              ) : (
                weakTopics.map((topic) => (
                  <div key={topic.topicId} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-ink-700 dark:text-ink-200">{topic.name}</span>
                    <span className="nums shrink-0 text-xs font-semibold text-danger-600 dark:text-danger-500">
                      {formatPercent(topic.accuracy, 0)} accuracy
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Achievements"
              description={`${achievementRows.length} of ${Object.keys(ACHIEVEMENTS).length} earned`}
              action={
                <Link href="/dashboard/achievements" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                  View
                </Link>
              }
            />
            <CardBody>
              {achievementRows.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">Complete mock tests to start earning achievements.</p>
              ) : (
                <ul className="space-y-2">
                  {achievementRows.slice(0, 3).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink-900 dark:text-ink-100">{row.achievement.title}</span>
                      <Badge tone="success">{formatDateTime(row.earnedAt).split(",")[0]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {attemptCount === 0 ? (
        <Alert tone="info" title="How to get the most out of RankForge">
          Take one Easy test to calibrate, review every explanation, then move up difficulty. The analytics page tracks
          your trend so improvement is visible, not assumed.
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/dashboard/analytics" variant="secondary" size="md">
            Analyse performance <ArrowRight className="h-4 w-4" aria-hidden />
          </LinkButton>
          <LinkButton href="/leaderboards" variant="secondary" size="md">
            Compare on leaderboards
          </LinkButton>
        </div>
      )}

      {results.some((result) => result.attempt.exam) &&
      results.some((result) => result.attempt.status === ATTEMPT_STATUS.AUTO_SUBMITTED) ? (
        <Alert tone="warn" title="Auto-submitted attempt detected">
          At least one attempt was submitted automatically when the timer expired. Review it on the attempts page to
          see which questions were unanswered.
        </Alert>
      ) : null}
    </div>
  );
}
