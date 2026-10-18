"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, FieldError, Input, Label } from "@/components/ui";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? "") }),
      });
      const body = (await response.json()) as {
        message?: string;
        devResetUrl?: string;
        error?: { message: string; fields?: Record<string, string[]> };
      };
      if (!response.ok) {
        setFieldError(body.error?.fields?.email?.[0] ?? null);
        setError(body.error?.message ?? "We could not process that request. Please try again.");
        return;
      }
      setDone(body.message ?? "If that email is registered, a reset link is on its way.");
      setDevLink(body.devResetUrl ?? null);
    } catch {
      setError("Network problem - check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your inbox">
          {done}
        </Alert>
        {devLink ? (
          <Alert tone="warn" title="Development mode">
            Email delivery is not configured. Use this link to reset your password:{" "}
            <Link href={devLink} className="font-medium underline">
              Reset password now
            </Link>
          </Alert>
        ) : null}
        <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus maxLength={254} />
        <FieldError>{fieldError}</FieldError>
      </div>
      <Button type="submit" loading={busy} size="lg" className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}
