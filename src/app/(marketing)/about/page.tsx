import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { BarChart3, FileText, ShieldCheck, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description: "Why RankForge exists: honest, exam-realistic CBT practice for Indian competitive examination aspirants.",
};

const principles = [
  {
    icon: Target,
    title: "Exam realism above all",
    body: "A mock test only teaches you something if it behaves like the real thing: a server-enforced clock, a proper question palette, correct marking schemes, and no way to pause reality. We build for that.",
  },
  {
    icon: BarChart3,
    title: "Honest analytics",
    body: "We show accuracy, negative-marking impact and pace - the numbers that actually explain a score. No vanity metrics, no inflated percentiles.",
  },
  {
    icon: ShieldCheck,
    title: "Integrity by design",
    body: "Timing and scoring happen on the server. Answer keys never reach your browser before submission. Practising under integrity rules makes exam day familiar, not novel.",
  },
  {
    icon: FileText,
    title: "Original content",
    body: "Every question on RankForge is an original practice item written for this platform. We do not reproduce copyrighted question papers from any examination body.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">About RankForge</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600 dark:text-ink-300">
          RankForge is a practice platform for aspirants preparing for national competitive examinations in India. It
          exists for one reason: most practice tools simulate the syllabus, but few simulate the <em>exam</em> - the
          clock, the pressure, the marking scheme and the consequence of a careless click.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {principles.map((principle) => (
          <Card key={principle.title}>
            <CardHeader title={principle.title} action={<principle.icon className="h-4 w-4 text-brand-500" aria-hidden />} />
            <CardBody>
              <p className="text-sm leading-6 text-ink-600 dark:text-ink-300">{principle.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">How the platform works</h2>
        <div className="prose-legal">
          <p>
            When you start a test, the server builds a private, ordered paper for you from a question pool, records the
            exact start time and locks in a deadline. Your answers autosave continuously. When you submit - or when the
            deadline passes - the attempt is closed permanently and scored by the same code that produced the paper, so
            the marking scheme and question-level marks are guaranteed to match what you saw.
          </p>
          <p>
            Results carry a subject and topic breakdown, and published results feed the practice leaderboards under a
            documented ranking policy: score first, then every tie-break rule that the test was configured with, with
            equal ranks for genuine ties.
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-ink-200 px-5 py-4 dark:border-ink-800">
        <h2 className="text-sm font-semibold text-ink-950 dark:text-ink-50">Independence notice</h2>
        <p className="mt-2 text-xs leading-6 text-ink-500 dark:text-ink-400">
          RankForge is an independent, privately operated practice platform. It is not affiliated with, endorsed by, or
          connected to the National Testing Agency, the Staff Selection Commission, any banking or railway recruitment
          board, any state examination authority, or any government body. Examination names are used only to describe
          the category of preparation a mock test is intended for.
        </p>
      </section>
    </div>
  );
}
