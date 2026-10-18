import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { BarChart, LineChart } from "@/components/charts";
import { Card, CardBody, CardHeader, EmptyState, LinkButton, Stat } from "@/components/ui";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/constants";
import { formatDuration, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
};

type SubjectAggregate = { name: string; correct: number; wrong: number; total: number; score: number; maxScore: number };

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const results = await prisma.result.findMany({
    where: { userId: user.id, attempt: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, invalidatedAt: null } },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { attempt: { include: { exam: { select: { title: true, difficulty: true } } } } },
  });

  if (results.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Analytics</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Patterns in your performance, once you have data.</p>
        </header>
        <Card>
          <CardBody>
            <EmptyState
              title="No scored attempts yet"
              description="Complete at least one mock test to unlock score trends, subject accuracy and difficulty breakdowns."
              action={<LinkButton href="/mock-tests" size="sm">Take a mock test</LinkButton>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const recent = results.slice(-12);
  const trendPoints = recent.map((result) => ({
    label: result.attempt.exam.title.length > 18 ? `${result.attempt.exam.title.slice(0, 16)}…` : result.attempt.exam.title,
    value: Math.round(result.percentage * 10) / 10,
  }));
  const accuracyPoints = recent.map((result) => ({
    label: result.attempt.exam.title.length > 18 ? `${result.attempt.exam.title.slice(0, 16)}…` : result.attempt.exam.title,
    value: Math.round(result.accuracy * 10) / 10,
  }));

  const subjectMap = new Map<string, SubjectAggregate>();
  for (const result of results) {
    const subjects = JSON.parse(result.subjectBreakdown) as Array<{
      subjectId: string;
      subjectName: string;
      score: number;
      maxScore: number;
      correct: number;
      wrong: number;
      unanswered: number;
    }>;
    for (const subject of subjects) {
      const entry = subjectMap.get(subject.subjectId) ?? {
        name: subject.subjectName,
        correct: 0,
        wrong: 0,
        total: 0,
        score: 0,
        maxScore: 0,
      };
      entry.correct += subject.correct;
      entry.wrong += subject.wrong;
      entry.total += subject.correct + subject.wrong + subject.unanswered;
      entry.score += subject.score;
      entry.maxScore += subject.maxScore;
      subjectMap.set(subject.subjectId, entry);
    }
  }
  const subjectBars = [...subjectMap.values()]
    .map((subject) => ({
      label: subject.name,
      value: Math.round(((subject.correct / Math.max(1, subject.correct + subject.wrong)) * 100) * 10) / 10,
      detail: subject,
    }))
    .sort((a, b) => a.value - b.value);

  const difficultyMap = new Map<string, { attempts: number; percentageTotal: number; accuracyTotal: number }>();
  for (const result of results) {
    const difficulty = result.attempt.exam.difficulty;
    const entry = difficultyMap.get(difficulty) ?? { attempts: 0, percentageTotal: 0, accuracyTotal: 0 };
    entry.attempts += 1;
    entry.percentageTotal += result.percentage;
    entry.accuracyTotal += result.accuracy;
    difficultyMap.set(difficulty, entry);
  }

  const totalCorrect = results.reduce((total, result) => total + result.correctCount, 0);
  const totalWrong = results.reduce((total, result) => total + result.wrongCount, 0);
  const totalUnanswered = results.reduce((total, result) => total + result.unansweredCount, 0);
  const totalTime = results.reduce((total, result) => total + result.timeUsedSec, 0);
  const overallAccuracy = (totalCorrect / Math.max(1, totalCorrect + totalWrong)) * 100;
  const firstHalf = results.slice(0, Math.floor(results.length / 2));
  const secondHalf = results.slice(Math.floor(results.length / 2));
  const average = (rows: typeof results) => (rows.length > 0 ? rows.reduce((t, r) => t + r.percentage, 0) / rows.length : 0);
  const momentum = secondHalf.length > 0 && firstHalf.length > 0 ? average(secondHalf) - average(firstHalf) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Analytics</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Based on your last {results.length} scored attempt(s). Trends, not single scores, tell the real story.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Overall accuracy" value={formatPercent(overallAccuracy)} hint={`${totalCorrect} correct · ${totalWrong} wrong`} />
        <Stat
          label="Momentum"
          value={momentum !== null ? `${momentum >= 0 ? "+" : ""}${momentum.toFixed(1)} pts` : "-"}
          hint={momentum !== null ? "Recent half vs earlier half of attempts" : "Needs at least two attempts"}
        />
        <Stat label="Unanswered" value={totalUnanswered} hint="Leaving questions blank protects against negative marking" />
        <Stat label="Time under exam conditions" value={formatDuration(totalTime)} hint="Cumulative across these attempts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Score trend" description="Percentage achieved per mock test, oldest to newest" />
          <CardBody>
            <LineChart points={trendPoints} ariaLabel="Score percentage trend across recent mock tests" valueSuffix="%" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Accuracy trend" description="Correct answers as a share of attempted questions" />
          <CardBody>
            <LineChart points={accuracyPoints} ariaLabel="Accuracy trend across recent mock tests" valueSuffix="%" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Subject accuracy"
            description="Correct vs attempted per subject across all attempts - weakest first"
          />
          <CardBody>
            <BarChart
              bars={subjectBars.map((bar) => ({ label: bar.label, value: bar.value }))}
              ariaLabel="Accuracy by subject"
              valueSuffix="%"
              max={100}
            />
            <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-3.5 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
              {subjectBars.map((bar) => (
                <p key={bar.label} className="nums">
                  <span className="font-medium text-ink-700 dark:text-ink-200">{bar.label}:</span> {bar.detail.correct} correct,{" "}
                  {bar.detail.wrong} wrong · net score {bar.detail.score} / {bar.detail.maxScore}
                </p>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Difficulty breakdown" description="Where your scores say you are ready to push" />
            <CardBody className="space-y-3">
              {(["EASY", "MEDIUM", "HARD"] as const).map((difficulty) => {
                const entry = difficultyMap.get(difficulty);
                if (!entry || entry.attempts === 0) {
                  return (
                    <div key={difficulty} className="flex items-center justify-between text-sm">
                      <span className="text-ink-500 dark:text-ink-400">{DIFFICULTY_LABELS[difficulty as Difficulty]}</span>
                      <span className="text-xs text-ink-400 dark:text-ink-500">No attempts yet</span>
                    </div>
                  );
                }
                return (
                  <div key={difficulty} className="rounded-lg border border-ink-100 px-3.5 py-3 dark:border-ink-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-900 dark:text-ink-100">
                        {DIFFICULTY_LABELS[difficulty as Difficulty]}
                      </span>
                      <span className="nums text-xs text-ink-500 dark:text-ink-400">{entry.attempts} attempt(s)</span>
                    </div>
                    <p className="nums mt-1 text-xs text-ink-500 dark:text-ink-400">
                      Avg score {formatPercent(entry.percentageTotal / entry.attempts)} · avg accuracy{" "}
                      {formatPercent(entry.accuracyTotal / entry.attempts)}
                    </p>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reading these numbers" />
            <CardBody>
              <ul className="space-y-2 text-xs leading-5 text-ink-500 dark:text-ink-400">
                <li>
                  A rising accuracy trend with flat scores usually means marking discipline is the limiting factor -
                  attempt fewer questions with more certainty.
                </li>
                <li>
                  Unanswered counts above zero are not failures; with negative marking they are often the mathematically
                  correct choice.
                </li>
                <li>Compare the subject bars against the time you spend per subject, not just raw accuracy.</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
