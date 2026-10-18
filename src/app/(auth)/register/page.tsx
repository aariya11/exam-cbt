import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-context";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a free RankForge account to take timed mock tests with instant scoring and practice rankings.",
};

export const dynamic = "force-dynamic";

function safeNext(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <div className="card-surface p-6 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Create your free account</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-500 dark:text-ink-400">
        Free while RankForge is in preview. No card, no payment details.
      </p>
      <RegisterForm nextPath={nextPath} />
    </div>
  );
}
