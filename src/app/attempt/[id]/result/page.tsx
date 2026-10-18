import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { getResultView, type ResultQuestionReview } from "@/lib/attempt-view";
import { AppError } from "@/lib/errors";
import { Badge, Card, CardBody, CardHeader, LinkButton, Stat, Table, Td, Th, difficultyTone } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { MathText } from "@/components/math-text";
import { PrintButton } from "@/components/exam/print-button";
import { ATTEMPT_STATUS, DIFFICULTY_LABELS, RANKING_DISCLAIMER, type Difficulty } from "@/lib/constants";
import { formatClock, formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { CheckCircle2, CircleSlash, Clock3, Flame, Timer, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scorecard",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function ResultPage({ params }: { params: Params }) {
  const { id } = await params;
  const auth = await getAuthContext();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/attempt/${id}/result`)}`);

  let view;
  try {
    view = await getResultView(id, auth.user.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const exam = await prisma.exam.findUnique({ where: { slug: view.examSlug }, select: { id: true, maxAttempts: true } });
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    select: { startedAt: true, deadlineAt: true },
  });

  if (!view.published) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14">
        <Card>
          <CardHeader title="Attempt submitted" description={`${view.examTitle}`} />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-ink-600 dark:text-ink-300">
              Your answers were received and scored. The examination rules publish results{" "}
              {view.status === ATTEMPT_STATUS.AUTO_SUBMITTED ? "after the scheduled publication time" : "on a schedule"} -
              you will see the full scorecard here as soon as it is published.
            </p>
            {view.resultsPublishAt ? (
              <p className="nums text-xs text-ink-500 dark:text-ink-400">
                Scheduled publication: {formatDateTime(view.resultsPublishAt)}
              </p>
            ) : (
              <p className="text-xs text-ink-500 dark:text-ink-400">
                Result publication for this test is controlled by the examination administrator.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/dashboard/attempts" size="md">
                Back to my attempts
              </LinkButton>
              <LinkButton href="/mock-tests" variant="secondary" size="md">
                Browse more tests
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const topicBars = view.topicBreakdown
    .filter((topic) => topic.correct + topic.partial + topic.wrong + topic.unanswered > 0)
    .map((topic) => ({
      label: topic.topicName,
      value: Math.round((topic.correct / Math.max(1, topic.correct + topic.partial + topic.wrong)) * 1000) / 10,
    }))
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="no-print text-xs text-ink-500 dark:text-ink-400">
        <Link href="/dashboard" className="hover:text-brand-600">
          Dashboard
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/dashboard/attempts" className="hover:text-brand-600">
          My attempts
        </Link>
        <span className="mx-1.5">/</span>
        <span>Scorecard</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={difficultyTone(view.difficulty)}>
              {DIFFICULTY_LABELS[view.difficulty as Difficulty] ?? view.difficulty}
            </Badge>
            {view.status === ATTEMPT_STATUS.AUTO_SUBMITTED ? <Badge tone="warn">Auto-submitted at deadline</Badge> : null}
            {view.status === ATTEMPT_STATUS.INVALIDATED ? <Badge tone="danger">Invalidated</Badge> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">{view.examTitle}</h1>
          <p className="nums mt-1 text-sm text-ink-500 dark:text-ink-400">
            {formatDateTime(view.startedAt)}
            {view.submittedAt ? ` → ${formatDateTime(view.submittedAt)}` : ""}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <Link
            href={`/mock-tests/${view.examSlug}`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            Retake / details
          </Link>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">Your score</p>
            <p className="nums mt-1 text-4xl font-bold tracking-tight text-ink-950 dark:text-ink-50">
              {view.score}
              <span className="text-lg font-medium text-ink-400"> / {view.maxScore}</span>
            </p>
            <p className="nums mt-1 text-sm text-ink-600 dark:text-ink-300">{formatPercent(view.percentage)} of maximum marks</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-4 dark:border-ink-800">
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Accuracy</p>
                <p className="nums mt-0.5 text-lg font-semibold text-ink-950 dark:text-ink-50">{formatPercent(view.accuracy)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Time used</p>
                <p className="nums mt-0.5 text-lg font-semibold text-ink-950 dark:text-ink-50">{formatDuration(view.timeUsedSec)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Attempted</p>
                <p className="nums mt-0.5 text-lg font-semibold text-ink-950 dark:text-ink-50">
                  {view.correctCount + view.partialCount + view.wrongCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-500 dark:text-ink-400">Questions</p>
                <p className="nums mt-0.5 text-lg font-semibold text-ink-950 dark:text-ink-50">
                  {view.correctCount + view.partialCount + view.wrongCount + view.unansweredCount}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Practice rank" description="Among participants on this mock test" />
          <CardBody>
            {view.rankSnapshot !== null && view.totalParticipants !== null ? (
              <>
                <p className="nums text-4xl font-bold tracking-tight text-ink-950 dark:text-ink-50">#{view.rankSnapshot}</p>
                <p className="nums mt-1 text-sm text-ink-500 dark:text-ink-400">
                  of {view.totalParticipants} participant(s) with published results
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-500 dark:text-ink-400">
                A rank is not available for this attempt (results publication or participant data is still pending).
              </p>
            )}
            <p className="mt-3 text-[11px] leading-5 text-ink-400 dark:text-ink-500">{RANKING_DISCLAIMER}</p>
            {exam ? (
              <Link
                href={`/leaderboards?scope=EXAM&examId=${exam.id}`}
                className="no-print mt-3 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                View the full leaderboard →
              </Link>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Correct" value={view.correctCount} icon={<CheckCircle2 className="h-4 w-4 text-success-500" aria-hidden />} />
        <Stat label="Incorrect" value={view.wrongCount} icon={<XCircle className="h-4 w-4 text-danger-500" aria-hidden />} />
        <Stat label="Unanswered" value={view.unansweredCount} icon={<CircleSlash className="h-4 w-4 text-ink-400" aria-hidden />} />
        <Stat
          label="Effective pace"
          value={
            view.correctCount + view.partialCount + view.wrongCount > 0
              ? formatClock(view.timeUsedSec / (view.correctCount + view.partialCount + view.wrongCount))
              : "-"
          }
          hint="average time per attempted question"
          icon={<Timer className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Subject breakdown" description="Where the marks were won and lost" />
          <CardBody className="px-0 py-0">
            <Table>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">Correct</Th>
                  <Th className="text-right">Wrong</Th>
                  <Th className="text-right">Blank</Th>
                </tr>
              </thead>
              <tbody>
                {view.subjectBreakdown.map((subject) => (
                  <tr key={subject.subjectId}>
                    <Td className="font-medium text-ink-900 dark:text-ink-100">{subject.subjectName}</Td>
                    <Td className="nums text-right">
                      {subject.score} / {subject.maxScore}
                    </Td>
                    <Td className="nums text-right">{subject.correct}</Td>
                    <Td className="nums text-right">{subject.wrong}</Td>
                    <Td className="nums text-right">{subject.unanswered}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Topic accuracy" description="Correct answers as a share of attempted questions per topic" />
          <CardBody>
            {topicBars.length > 0 ? (
              <BarChart bars={topicBars} ariaLabel="Accuracy by topic" valueSuffix="%" max={100} />
            ) : (
              <p className="text-sm text-ink-500 dark:text-ink-400">No topic-level data for this paper.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {view.finalizeReason === "deadline_exceeded" ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warn-500/40 bg-warn-50 px-4 py-3.5 dark:bg-warn-500/10">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" aria-hidden />
          <p className="text-xs leading-5 text-warn-600 dark:text-warn-500">
            This attempt was submitted automatically when the timer expired. Answers saved before the deadline were
            scored; anything after the deadline was not accepted.
          </p>
        </div>
      ) : null}

      {view.revealSolutions && view.review ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Solutions review</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Every question with your answer, the correct answer and a full explanation.
          </p>
          <div className="mt-4 space-y-3">
            {view.review.map((question) => (
              <ReviewItem key={question.questionId} question={question} />
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8 rounded-xl border border-ink-200 px-4 py-3.5 text-sm text-ink-500 dark:border-ink-800 dark:text-ink-400">
          {view.revealSolutions
            ? "Solutions will appear here once the examination administrator publishes them."
            : "Solutions are not released for this mock test."}
        </div>
      )}

      <div className="no-print mt-8 flex flex-wrap gap-2">
        <LinkButton href="/dashboard/analytics" variant="secondary" size="md">
          <Flame className="h-4 w-4" aria-hidden /> Analyse your performance
        </LinkButton>
        <LinkButton href="/mock-tests" variant="secondary" size="md">
          Take another mock test
        </LinkButton>
      </div>
    </div>
  );
}

const outcomeMeta: Record<ResultQuestionReview["outcome"], { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  correct: { label: "Correct", tone: "success" },
  partial: { label: "Partial credit", tone: "warn" },
  wrong: { label: "Incorrect", tone: "danger" },
  unanswered: { label: "Not answered", tone: "neutral" },
};

function ReviewItem({ question }: { question: ResultQuestionReview }) {
  const meta = outcomeMeta[question.outcome];
  const correct = new Set(question.correctOptionIds ?? []);
  const selected = new Set(question.selectedOptionIds);

  return (
    <details className="group rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900/40">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 marker:content-none">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="nums rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200">
            Q{question.order}
          </span>
          <span className="truncate text-sm text-ink-700 group-open:whitespace-normal dark:text-ink-200">
            <MathText text={question.text.slice(0, 120) + (question.text.length > 120 ? "…" : "")} />
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="nums text-xs font-semibold text-ink-500 dark:text-ink-400">
            {question.awarded > 0 ? `+${question.awarded}` : question.awarded < 0 ? question.awarded : "0"}
          </span>
        </span>
      </summary>
      <div className="border-t border-ink-100 px-4 py-4 dark:border-ink-800">
        <p className="text-sm leading-7 text-ink-900 dark:text-ink-50">
          <MathText text={question.text} />
        </p>
        <ul className="mt-3 space-y-2">
          {question.options.map((option, index) => {
            const isCorrect = correct.has(option.id);
            const isSelected = selected.has(option.id);
            return (
              <li
                key={option.id}
                className={
                  isCorrect
                    ? "flex items-start gap-2.5 rounded-lg border border-success-500/50 bg-success-50 px-3.5 py-2.5 dark:bg-success-500/10"
                    : isSelected
                      ? "flex items-start gap-2.5 rounded-lg border border-danger-500/50 bg-danger-50 px-3.5 py-2.5 dark:bg-danger-500/10"
                      : "flex items-start gap-2.5 rounded-lg border border-ink-200 px-3.5 py-2.5 dark:border-ink-700"
                }
              >
                <span className="nums text-sm font-semibold text-ink-500 dark:text-ink-400">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="flex-1 text-sm leading-6 text-ink-800 dark:text-ink-100">
                  <MathText text={option.text} />
                </span>
                {isCorrect ? <Badge tone="success">Correct answer</Badge> : null}
                {isSelected && !isCorrect ? <Badge tone="danger">Your answer</Badge> : null}
                {isSelected && isCorrect ? <Badge tone="success">Your answer</Badge> : null}
              </li>
            );
          })}
        </ul>
        {question.explanation ? (
          <div className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3 dark:bg-ink-800/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">Explanation</p>
            <p className="mt-1 text-sm leading-6 text-ink-700 dark:text-ink-200">
              <MathText text={question.explanation} />
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
