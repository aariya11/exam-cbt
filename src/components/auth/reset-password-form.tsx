"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setFields({ confirm: "Passwords do not match." });
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json()) as {
        error?: { message: string; fields?: Record<string, string[]> };
      };
      if (!response.ok) {
        if (body.error?.fields) {
          const mapped: Record<string, string> = {};
          for (const [key, messages] of Object.entries(body.error.fields)) mapped[key] = messages[0] ?? "";
          setFields(mapped);
        }
        setError(body.error?.message ?? "We could not reset your password. Request a new link and try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network problem - check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password updated">
          You have been signed out everywhere for security. Sign in with your new password.
        </Alert>
        <Button onClick={() => router.push("/login")} className="w-full" size="lg">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus minLength={8} maxLength={128} />
        <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
          At least 8 characters with an uppercase letter, a lowercase letter and a number.
        </p>
        <FieldError>{fields.password}</FieldError>
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <FieldError>{fields.confirm}</FieldError>
      </div>
      <Button type="submit" loading={busy} size="lg" className="w-full">
        Set new password
      </Button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        Link expired?{" "}
        <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Request a new one
        </Link>
      </p>
    </form>
  );
}
