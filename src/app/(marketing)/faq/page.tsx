import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about RankForge mock tests, timing, scoring, negative marking, leaderboards and accounts.",
};

const faqs: { question: string; answer: string }[] = [
  {
    question: "Is RankForge affiliated with any examination authority?",
    answer:
      "No. RankForge is an independent practice platform. Every question is original content written for this platform, and examination names are used only to describe the type of preparation a mock test is intended for.",
  },
  {
    question: "How is the timer enforced?",
    answer:
      "The countdown is calculated from a server-side start time and deadline. Refreshing the page, closing the tab or switching devices does not pause the paper. When the deadline passes, the attempt is submitted automatically with the answers saved at that moment.",
  },
  {
    question: "What happens if my internet drops mid-test?",
    answer:
      "Your answers are saved continuously as you work. If the connection drops, keep working - changes are retried automatically. When the connection returns, your attempt resumes exactly where it was, with the correct remaining time.",
  },
  {
    question: "How does scoring work?",
    answer:
      "Each test publishes its marking scheme on the instructions page: marks per correct answer and negative marks per wrong answer. The scorecard shows total score, maximum marks, accuracy, attempted, correct, incorrect and unanswered counts, plus a subject-wise breakdown.",
  },
  {
    question: "When can I see the correct answers and explanations?",
    answer:
      "For tests that allow solution release, full explanations become available once you submit and results are published. Answer keys are never sent to the browser before submission.",
  },
  {
    question: "How are leaderboard ranks decided?",
    answer:
      "Ranking starts with score. Each test can add published tie-break rules (for example, higher accuracy first, then fewer incorrect answers). Participants who are still equal share the same rank. Aggregated boards across many tests rank on percentage. All of this is described on the leaderboards page.",
  },
  {
    question: "Can I retake a mock test?",
    answer:
      "Each test states its attempt limit on its detail page. Unlimited-attempt tests can be retaken as often as you like; limited tests show how many attempts you have left. Leaderboards use your best eligible attempt.",
  },
  {
    question: "Do you record me during a test?",
    answer:
      "No camera or microphone access is requested. RankForge records technical integrity signals only - such as resuming on a second device during an active attempt, and switching away from the test window - so that practice happens under realistic, self-disciplined conditions.",
  },
  {
    question: "How do I delete my account and data?",
    answer:
      "Account deletion is available from your profile page. Deleting your account removes your personal data from the platform, subject to the limited retention described in the privacy policy.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Frequently asked questions</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
          The short, honest answers. For anything else,{" "}
          <Link href="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
            write to us
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 divide-y divide-ink-200 rounded-xl border border-ink-200 bg-white dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900/40">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink-900 marker:content-none dark:text-ink-100">
              {faq.question}
              <span className="text-ink-400 transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-ink-600 dark:text-ink-300">{faq.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
