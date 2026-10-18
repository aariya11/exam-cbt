import type { Metadata } from "next";
import { Logo } from "@/components/site/logo";
import { Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "Scheduled maintenance",
  description: "RankForge is undergoing scheduled maintenance and will be back shortly.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center dark:bg-ink-950">
      <Logo />
      <span className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-warn-50 text-warn-600 dark:bg-warn-500/10 dark:text-warn-500">
        <Wrench className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">
        We are doing scheduled maintenance
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400">
        RankForge is temporarily unavailable while we upgrade the platform. Any attempt in progress is being handled
        exactly as the examination rules describe, and nothing you have already submitted is affected.
      </p>
      <p className="mt-6 text-xs text-ink-400 dark:text-ink-500">Please check back in a short while.</p>
    </div>
  );
}
