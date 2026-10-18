import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Step-by-step guidance for taking a RankForge mock test, understanding your scorecard and using analytics.",
};

const guides = [
  {
    title: "Taking your first mock test",
    steps: [
      "Create an account and verify your email address.",
      "Open Mock tests and filter by examination and difficulty.",
      "Read the instructions on the test page - duration, marking scheme and section structure.",
      "Press Start test. The countdown begins immediately and runs on the server.",
      "Use the question palette to jump around; save and next moves you forward; mark for review flags questions to revisit.",
      "Press Submit test when you are done. You can review marked questions first - submission is final.",
    ],
  },
  {
    title: "If your connection drops mid-test",
    steps: [
      "Keep working - the palette shows the state from your last successful save.",
      "Answers are retried automatically when the connection returns; a small indicator shows save status.",
      "If you must leave entirely, reopen the test page and choose Resume in-progress attempt. Your deadline does not pause.",
      "If the timer reaches zero while you are offline, the attempt is scored from the answers the server had already saved.",
    ],
  },
  {
    title: "Understanding your scorecard",
    steps: [
      "Score / max marks applies the published marking scheme, including negative marks.",
      "Accuracy is correct answers as a share of attempted questions - a low accuracy with high attempts usually means negative-marking damage.",
      "The subject and topic breakdowns show where marks were won and lost, with the negative-marking impact isolated.",
      "Time analysis compares your pace with the paper's allocation, per question.",
      "Where solutions are enabled, open any question to see the correct answer, your answer and a full explanation.",
    ],
  },
  {
    title: "Rankings explained",
    steps: [
      "Only published results from valid, submitted attempts count towards rankings.",
      "A test ranks on score first, then on the tie-break rules shown on its page, then shares ranks for genuine ties.",
      "Boards across many tests (category, difficulty, series, subject) rank on percentage to keep papers of different lengths comparable.",
      "Your best eligible attempt counts once per leaderboard.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Help centre</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
          Practical guidance for exam day on RankForge. For anything not covered here, check the{" "}
          <Link href="/faq" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            FAQ
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            contact support
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 space-y-5">
        {guides.map((guide) => (
          <Card key={guide.title}>
            <CardHeader title={guide.title} />
            <CardBody>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-600 dark:text-ink-300">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
