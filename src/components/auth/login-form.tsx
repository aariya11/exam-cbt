"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    const payload = {
      identifier: String(form.get("identifier") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        user?: { role: string };
        error?: { message: string; fields?: Record<string, string[]> };
      };
      if (!response.ok) {
        if (body.error?.fields) {
          const mapped: Record<string, string> = {};
          for (const [key, messages] of Object.entries(body.error.fields)) mapped[key] = messages[0] ?? "";
          setFields(mapped);
        }
        setError(body.error?.message ?? "Sign-in failed. Check your details and try again.");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Network problem - check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="identifier">Email or username</Label>
        <Input id="identifier" name="identifier" autoComplete="username" required autoFocus maxLength={254} />
        <FieldError>{fields.identifier}</FieldError>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
            Forgot password?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
        <FieldError>{fields.password}</FieldError>
      </div>
      <Button type="submit" loading={busy} size="lg" className="w-full">
        Sign in
      </Button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        New to RankForge?{" "}
        <Link
          href={`/register${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
