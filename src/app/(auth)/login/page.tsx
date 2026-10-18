import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-context";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your RankForge account to take mock tests and view your analytics.",
};

export const dynamic = "force-dynamic";

function safeNext(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Welcome back</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-500 dark:text-ink-400">
        Sign in to continue practising and see where you stand.
      </p>
      <LoginForm nextPath={nextPath} />
    </div>
  );
}
