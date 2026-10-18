import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Confirm your email address to unlock RankForge mock tests.",
};

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Verify your email</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-500 dark:text-ink-400">
        Verification keeps your account recoverable and lets you start tests.
      </p>
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <VerifyEmailClient />
      </Suspense>
    </div>
  );
}
