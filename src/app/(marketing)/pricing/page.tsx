import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, CardBody, LinkButton } from "@/components/ui";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description: "RankForge pricing: every mock test, scorecard and leaderboard is free while the platform is in preview.",
};

const included = [
  "Unlimited access to every active mock test",
  "Server-timed CBT interface with question palette and autosave",
  "Instant scorecards with subject and topic breakdowns",
  "Solutions and explanations where the test allows release",
  "Practice leaderboards with documented tie-break policy",
  "Achievements and attempt history",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Simple, honest pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          RankForge is currently in preview. Every feature on this site is free while we validate the platform with
          real aspirants. When paid plans arrive, existing accounts will be told clearly and in advance.
        </p>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col p-6">
          <h2 className="text-base font-semibold text-ink-950 dark:text-ink-50">Free during preview</h2>
          <p className="nums mt-2 text-3xl font-bold tracking-tight text-ink-950 dark:text-ink-50">
            ₹0 <span className="text-sm font-medium text-ink-500 dark:text-ink-400">/ month</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <LinkButton href="/register" className="mt-6 w-full" size="lg">
            Create free account
          </LinkButton>
        </Card>

        <Card className="flex flex-col p-6">
          <h2 className="text-base font-semibold text-ink-950 dark:text-ink-50">For institutions</h2>
          <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
            Coaching centres and schools can use RankForge papers for internal mock drives. Institution accounts get
            cohort-level reporting and dedicated support. Availability depends on capacity - talk to us first.
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {[
              "Private test windows for your batches",
              "Cohort score and participation summaries",
              "CSV exports for internal review (no student emails)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <LinkButton href="/contact" variant="secondary" className="mt-6 w-full" size="lg">
            Contact us
          </LinkButton>
        </Card>
      </div>

      <Alert tone="info" className="mt-8">
        No payment details are collected anywhere on this site today. If that changes, checkout will be handled by a
        recognised payment provider and this page will state the prices plainly before any payment is requested.
      </Alert>

      <p className="mt-6 text-center text-xs text-ink-500 dark:text-ink-400">
        Questions about pricing or refunds?{" "}
        <Link href="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Contact our team
        </Link>
        .
      </p>
    </div>
  );
}
