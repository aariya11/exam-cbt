import Link from "next/link";
import { prisma } from "@/lib/db";
import { ExamCard, type ExamCardData } from "@/components/exam-card";
import { Alert, Badge, Card, CardBody, CardHeader, LinkButton, buttonClass } from "@/components/ui";
import { RANKING_DISCLAIMER } from "@/lib/constants";
import { getExamParticipationStats, getLeaderboard, parseTieBreakRules } from "@/lib/leaderboard";
import { formatNumber } from "@/lib/format";
import { BarChart3, FileText, Lock, ScrollText, ShieldCheck, Timer, Trophy, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const steps = [
  {
    icon: UserCheck,
    title: "Create a free account",
    body: "Register with your email, confirm your identity and set up your profile. No payment required to start practising.",
  },
  {
    icon: FileText,
    title: "Choose a mock test",
    body: "Pick your examination and difficulty. Read the instructions - duration, marking scheme and sections - before you begin.",
  },
  {
    icon: Timer,
    title: "Attempt under exam conditions",
    body: "A server-timed paper with a question palette, mark-for-review and autosave. The countdown is enforced on the server, not in your browser.",
  },
  {
    icon: Trophy,
    title: "Review, learn, compete",
    body: "Instant scorecard with section breakdown, solutions where enabled, achievements and a spot on the practice leaderboard.",
  },
];

export default async function HomePage() {
  const [questionCount, activeExamCount, attemptCount, categories, exams] = await Promise.all([
    prisma.question.count({ where: { status: "PUBLISHED" } }),
    prisma.exam.count({ where: { status: "ACTIVE" } }),
    prisma.attempt.count({ where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] }, invalidatedAt: null } }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { exams: { where: { status: "ACTIVE" } } } } },
    }),
    prisma.exam.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
      include: { category: true, _count: { select: { questions: true } } },
      take: 6,
    }),
  ]);

  const stats = await getExamParticipationStats(exams.map((exam) => exam.id));

  const examCards: ExamCardData[] = exams.map((exam) => ({
    slug: exam.slug,
    title: exam.title,
    description: exam.description,
    categoryName: exam.category.name,
    difficulty: exam.difficulty,
    durationMinutes: exam.durationMinutes,
    marksPerCorrect: exam.marksPerCorrect,
    negativeMarksPerWrong: exam.negativeMarksPerWrong,
    questionCount: exam._count.questions,
    participants: stats.get(exam.id)?.participants ?? 0,
    averagePercentage: stats.get(exam.id)?.averagePercentage,
  }));

  // Leaderboard teaser: the most-attended active mock test.
  const busiest = [...exams].sort(
    (a, b) => (stats.get(b.id)?.participants ?? 0) - (stats.get(a.id)?.participants ?? 0),
  )[0];
  const preview = busiest
    ? await getLeaderboard({
        scope: "EXAM",
        examId: busiest.id,
        page: 1,
        pageSize: 5,
        tieBreakRules: parseTieBreakRules(busiest.tieBreakRules),
      })
    : null;

  return (
    <>
      {/* Hero */}
      <section className="border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.15fr_1fr] md:items-center md:py-20">
          <div>
            <Badge tone="brand" className="mb-4">
              Computer-based test simulator
            </Badge>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink-950 sm:text-4xl md:text-[2.75rem] dark:text-ink-50">
              Prepare. Compete. Prove yourself.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-600 dark:text-ink-300">
              RankForge gives serious aspirants a realistic, server-timed computer-based test experience for national
              competitive examinations - with instant scoring, honest analytics and practice rankings.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LinkButton href="/mock-tests" size="lg">
                Browse mock tests
              </LinkButton>
              <LinkButton href="/register" size="lg" variant="secondary">
                Create free account
              </LinkButton>
            </div>
            <dl className="nums mt-10 grid max-w-lg grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-ink-500 dark:text-ink-400">Published questions</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-950 dark:text-ink-50">{formatNumber(questionCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500 dark:text-ink-400">Active mock tests</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-950 dark:text-ink-50">{formatNumber(activeExamCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500 dark:text-ink-400">Tests completed</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-950 dark:text-ink-50">{formatNumber(attemptCount)}</dd>
              </div>
            </dl>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title={busiest ? busiest.title : "Practice leaderboard"}
              description="Top performers on this mock test"
              action={<Badge tone="brand">Live</Badge>}
            />
            <CardBody className="p-0">
              {preview && preview.entries.length > 0 ? (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {preview.entries.map((entry) => (
                    <li key={entry.userId} className="flex items-center gap-3 px-5 py-3">
                      <span className="nums flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-xs font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                        {entry.rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                          {entry.displayName}
                        </span>
                        <span className="nums block truncate text-xs text-ink-500 dark:text-ink-400">
                          {entry.accuracy}% accuracy · {entry.attempted} attempted
                        </span>
                      </span>
                      <span className="nums text-sm font-semibold text-ink-950 dark:text-ink-50">{entry.score}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
                  No attempts published on this test yet.
                </p>
              )}
              <div className="border-t border-ink-100 px-5 py-3 dark:border-ink-800">
                <p className="text-[11px] leading-5 text-ink-400 dark:text-ink-500">{RANKING_DISCLAIMER}</p>
                <Link
                  href="/leaderboards"
                  className="mt-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
                >
                  Explore all leaderboards →
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">How RankForge works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          A complete practice loop: register, attempt under exam conditions, then learn from a detailed, honest review.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="card-surface p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
                  <step.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="nums text-xs font-semibold text-ink-400 dark:text-ink-500">Step {index + 1}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink-950 dark:text-ink-50">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-ink-500 dark:text-ink-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Featured exams */}
      <section className="border-y border-ink-200 bg-white py-16 dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Featured mock tests</h2>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
                Full-length, timed papers with the marking schemes used by your examination.
              </p>
            </div>
            <Link href="/mock-tests" className={buttonClass("secondary", "md")}>
              View all
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examCards.map((exam) => (
              <ExamCard key={exam.slug} exam={exam} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Examinations we cover</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          Original practice questions across the subjects and difficulty levels these examinations test.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/exams/${category.slug}`}
              className="card-surface group p-5 transition-shadow hover:shadow-pop"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink-950 group-hover:text-brand-600 dark:text-ink-50 dark:group-hover:text-brand-300">
                  {category.name}
                </h3>
                <span className="nums rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                  {category._count.exams} test{category._count.exams === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-500 dark:text-ink-400">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Integrity */}
      <section className="border-y border-ink-200 bg-white py-16 dark:border-ink-800 dark:bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">
              Built like a real CBT window
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-600 dark:text-ink-300">
              The countdown, question paper and marking scheme live on the server. Answers autosave continuously, and a
              submitted paper is final. Rankings are computed from published results only, under a documented tie-break
              policy.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                { icon: Timer, text: "Server-enforced timing: refreshing or closing the tab does not pause your paper." },
                { icon: Lock, text: "One active session per attempt; a second device is detected and flagged for review." },
                { icon: ShieldCheck, text: "Answer keys are never sent to the browser before you submit." },
                { icon: ScrollText, text: "Every sensitive action is written to an audit trail for administrators." },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                    <item.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-sm leading-6 text-ink-600 dark:text-ink-300">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader
              title="What your scorecard includes"
              description="Available immediately after you submit, where the examination rules allow"
              action={<BarChart3 className="h-4 w-4 text-ink-400" aria-hidden />}
            />
            <CardBody>
              <ul className="space-y-2.5 text-sm text-ink-600 dark:text-ink-300">
                <li>Total score and maximum marks, with the marking scheme applied question by question</li>
                <li>Accuracy, attempted, correct, incorrect and unanswered counts</li>
                <li>Subject-wise breakdown with negative-marking impact shown honestly</li>
                <li>Time analysis: total time used and pace per question</li>
                <li>Practice rank with participation count and the tie-break policy applied</li>
                <li>Step-by-step solutions for every question when the test allows it</li>
              </ul>
              <Alert tone="info" className="mt-4">
                {RANKING_DISCLAIMER}
              </Alert>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Card className="flex flex-col items-center gap-4 bg-brand-500 px-6 py-12 text-center dark:bg-brand-700">
          <h2 className="text-2xl font-bold tracking-tight text-white">Your next attempt starts today</h2>
          <p className="max-w-xl text-sm leading-6 text-brand-50">
            Create a free account and take your first timed mock test in minutes. Detailed analytics and practice
            rankings are included.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Create free account
            </Link>
            <Link
              href="/mock-tests"
              className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Browse mock tests
            </Link>
          </div>
          <p className="text-xs text-brand-100">Free to start · No card required</p>
        </Card>
      </section>
    </>
  );
}
