import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { Alert, Badge, Card, CardBody, CardHeader, Table, Td, Th, difficultyTone } from "@/components/ui";
import { StartAttemptButton } from "@/components/exam/start-attempt-button";
import {
  ATTEMPT_STATUS,
  DIFFICULTY_LABELS,
  EXAM_STATUS,
  RANKING_DISCLAIMER,
  STAFF_ROLES,
  type Difficulty,
} from "@/lib/constants";
import { getExamParticipationStats } from "@/lib/leaderboard";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { AlertTriangle, Clock3, Info, ListChecks, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const exam = await prisma.exam.findUnique({ where: { slug }, select: { title: true, description: true } });
  if (!exam) return { title: "Mock test not found" };
  return { title: exam.title, description: exam.description };
}

export default async function MockTestDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const exam = await prisma.exam.findUnique({
    where: { slug },
    include: {
      category: true,
      series: true,
      sections: { orderBy: { sortOrder: "asc" }, include: { subject: true, _count: { select: { examQuestions: true } } } },
      _count: { select: { questions: true } },
    },
  });
  if (!exam) notFound();

  const user = await getCurrentUser();
  const isStaff = user ? STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]) : false;
  if (exam.status !== EXAM_STATUS.ACTIVE && !isStaff) notFound();

  const [stats, attempts] = await Promise.all([
    getExamParticipationStats([exam.id]),
    user
      ? prisma.attempt.findMany({
          where: { userId: user.id, examId: exam.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { result: { select: { score: true, maxScore: true, percentage: true, publishedAt: true, rankSnapshot: true } } },
        })
      : Promise.resolve([]),
  ]);

  const participants = stats.get(exam.id)?.participants ?? 0;
  const averagePercentage = stats.get(exam.id)?.averagePercentage;
  const inProgress = attempts.find((attempt) => attempt.status === ATTEMPT_STATUS.IN_PROGRESS);
  const countedAttempts = attempts.filter((attempt) => attempt.status !== ATTEMPT_STATUS.INVALIDATED).length;
  const attemptsExhausted = exam.maxAttempts !== null && countedAttempts >= exam.maxAttempts;
  const outsideWindow =
    (exam.opensAt && exam.opensAt > new Date()) || (exam.closesAt && exam.closesAt < new Date());

  const marking =
    exam.negativeMarksPerWrong > 0
      ? `+${exam.marksPerCorrect} for a correct answer, −${exam.negativeMarksPerWrong} for a wrong answer, 0 for unanswered`
      : `+${exam.marksPerCorrect} for a correct answer, no negative marking for wrong answers`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-500 dark:text-ink-400">
        <Link href="/mock-tests" className="hover:text-brand-600">
          Mock tests
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/exams/${exam.category.slug}`} className="hover:text-brand-600">
          {exam.category.name}
        </Link>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={difficultyTone(exam.difficulty)}>
              {DIFFICULTY_LABELS[exam.difficulty as Difficulty] ?? exam.difficulty}
            </Badge>
            {exam.series ? <Badge tone="brand">{exam.series.name}</Badge> : null}
            {exam.status !== EXAM_STATUS.ACTIVE ? <Badge tone="warn">{exam.status}</Badge> : null}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">{exam.title}</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600 dark:text-ink-300">{exam.description}</p>
        </div>
        <div className="min-w-56">
          {inProgress ? (
            <Link
              href={`/attempt/${inProgress.id}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-warn-500 px-5 text-sm font-medium text-white hover:bg-warn-600"
            >
              Resume in-progress attempt
            </Link>
          ) : (
            <StartAttemptButton
              examId={exam.id}
              examSlug={exam.slug}
              signedIn={Boolean(user)}
              disabled={Boolean(attemptsExhausted) || Boolean(outsideWindow)}
              disabledReason={
                attemptsExhausted
                  ? `You have used all ${exam.maxAttempts} allowed attempt(s) on this test.`
                  : outsideWindow
                    ? "This test is not open right now."
                    : undefined
              }
              label={user ? "Start test" : "Sign in to start"}
            />
          )}
          {exam.requiresDesktop ? (
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">Best taken on a desktop or laptop.</p>
          ) : null}
        </div>
      </header>

      <dl className="nums mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Clock3, label: "Duration", value: formatDuration(exam.durationMinutes * 60) },
          { icon: ListChecks, label: "Questions", value: String(exam._count.questions) },
          { icon: Users, label: "Participants", value: String(participants) },
          {
            icon: Info,
            label: "Average score",
            value: averagePercentage !== undefined ? formatPercent(averagePercentage) : "-",
          },
        ].map((item) => (
          <div key={item.label} className="card-surface px-4 py-3">
            <dt className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
              <item.icon className="h-3.5 w-3.5" aria-hidden /> {item.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-ink-950 dark:text-ink-50">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Instructions" description="Read carefully before you begin" />
            <CardBody>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-ink-600 dark:text-ink-300">
                <li>The countdown starts on the server the moment you begin and runs on {exam.durationMinutes} minutes.</li>
                <li>Marking: {marking}.</li>
                <li>Your answers autosave as you work. You may move between questions and mark any for review.</li>
                <li>When the timer reaches zero, the paper is submitted automatically with the answers saved at that moment.</li>
                <li>One active session per attempt. Opening the test elsewhere will be detected and flagged.</li>
                {exam.revealSolutions ? (
                  <li>Solutions and answer keys are shown after submission where results are published.</li>
                ) : (
                  <li>Solutions are not released for this test.</li>
                )}
                {exam.maxFocusWarnings > 0 ? (
                  <li>Leaving the test window is recorded. Repeated interruptions ({exam.maxFocusWarnings}+) are flagged for review.</li>
                ) : null}
              </ul>
              {exam.instructions ? (
                <p className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3 text-sm leading-6 text-ink-700 dark:bg-ink-800/60 dark:text-ink-200">
                  {exam.instructions}
                </p>
              ) : null}
              <p className="mt-4 text-xs leading-5 text-ink-400 dark:text-ink-500">{RANKING_DISCLAIMER}</p>
            </CardBody>
          </Card>

          {attempts.length > 0 ? (
            <Card>
              <CardHeader title="Your attempts on this test" description="Most recent first" />
              <CardBody className="px-0 py-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Started</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Score</Th>
                      <Th className="text-right">Rank</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <Td className="nums text-xs">{formatDateTime(attempt.startedAt)}</Td>
                        <Td>
                          {attempt.status === ATTEMPT_STATUS.IN_PROGRESS ? (
                            <Badge tone="warn">In progress</Badge>
                          ) : attempt.status === ATTEMPT_STATUS.INVALIDATED ? (
                            <Badge tone="danger">Invalidated</Badge>
                          ) : (
                            <Badge tone="success">Submitted</Badge>
                          )}
                        </Td>
                        <Td className="nums text-right">
                          {attempt.result
                            ? `${attempt.result.score} / ${attempt.result.maxScore}`
                            : attempt.status === ATTEMPT_STATUS.IN_PROGRESS
                              ? "-"
                              : "-"}
                        </Td>
                        <Td className="nums text-right">
                          {attempt.result?.publishedAt && attempt.result.rankSnapshot !== null
                            ? `#${attempt.result.rankSnapshot}`
                            : "-"}
                        </Td>
                        <Td className="text-right">
                          {attempt.status === ATTEMPT_STATUS.IN_PROGRESS ? (
                            <Link href={`/attempt/${attempt.id}`} className="text-xs font-medium text-warn-600 hover:underline">
                              Resume
                            </Link>
                          ) : attempt.result ? (
                            <Link href={`/attempt/${attempt.id}/result`} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                              View scorecard
                            </Link>
                          ) : (
                            <span className="text-xs text-ink-400">Awaiting results</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Paper structure" description={`${exam.sections.length} section(s)`} />
            <CardBody className="space-y-3">
              {exam.sections.map((section, index) => (
                <div key={section.id} className="rounded-lg border border-ink-100 px-3.5 py-3 dark:border-ink-800">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    Section {String.fromCharCode(65 + index)} · {section.title}
                  </p>
                  <p className="nums mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                    {section.questionCount} question(s) · {section.subject.name}
                  </p>
                </div>
              ))}
              {exam.sections.length === 0 ? (
                <p className="text-sm text-ink-500">Section details will be published soon.</p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Marking scheme" />
            <CardBody className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
              <p className="nums">Correct answer: +{exam.marksPerCorrect}</p>
              <p className="nums">Wrong answer: {exam.negativeMarksPerWrong > 0 ? `−${exam.negativeMarksPerWrong}` : "0"}</p>
              <p className="nums">Unanswered: 0</p>
              {exam.allowPartialCredit ? <p>Partial credit applies to multi-select questions.</p> : null}
            </CardBody>
          </Card>

          {outsideWindow ? (
            <Alert tone="warn" title="Outside the examination window">
              <span className="nums">
                {exam.opensAt ? `Opens ${formatDateTime(exam.opensAt)}` : ""}
                {exam.opensAt && exam.closesAt ? " · " : ""}
                {exam.closesAt ? `Closes ${formatDateTime(exam.closesAt)}` : ""}
              </span>
            </Alert>
          ) : null}

          {exam.maxAttempts !== null ? (
            <Alert tone="info" title="Attempt limit">
              <span className="nums">
                {attemptsExhausted
                  ? `Attempt limit reached (${exam.maxAttempts}).`
                  : `You have used ${countedAttempts} of ${exam.maxAttempts} allowed attempt(s).`}
              </span>
            </Alert>
          ) : null}

          <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-4 py-3.5 dark:border-ink-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-500" aria-hidden />
            <p className="text-xs leading-5 text-ink-600 dark:text-ink-300">
              This is an original RankForge practice paper written for this platform. It is not an official question
              paper from any examination authority.
            </p>
          </div>

          {exam.requiresDesktop ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn-500/40 bg-warn-50 px-4 py-3.5 dark:bg-warn-500/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" aria-hidden />
              <p className="text-xs leading-5 text-warn-600 dark:text-warn-500">
                This test is designed for a desktop or laptop screen. Phones work but the question palette is tighter.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
