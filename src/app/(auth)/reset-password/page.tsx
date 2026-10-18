import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Set a new password for your RankForge account.",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token || token.length < 32) {
    return (
      <div className="card-surface p-6 text-center sm:p-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Invalid reset link</h1>
        <p className="mt-3 text-sm leading-6 text-ink-500 dark:text-ink-400">
          This password reset link is missing or malformed. Request a fresh link and use it promptly - reset links
          expire for your security.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Set a new password</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-500 dark:text-ink-400">
        Choose a strong password you do not use anywhere else.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
