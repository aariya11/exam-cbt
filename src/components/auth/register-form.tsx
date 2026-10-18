"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, FieldError, Input, Label, Select } from "@/components/ui";
import { INDIA_STATES } from "@/lib/constants";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ message: string; verifyUrl?: string } | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      displayName: String(form.get("displayName") ?? ""),
      username: String(form.get("username") ?? "").toLowerCase(),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      state: String(form.get("state") ?? "") || null,
      city: String(form.get("city") ?? "") || null,
      acceptTerms: form.get("acceptTerms") === "on",
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        user?: { emailVerified: boolean };
        devVerificationUrl?: string;
        error?: { message: string; fields?: Record<string, string[]> };
      };
      if (!response.ok) {
        if (body.error?.fields) {
          const mapped: Record<string, string> = {};
          for (const [key, messages] of Object.entries(body.error.fields)) mapped[key] = messages[0] ?? "";
          setFields(mapped);
        }
        setError(body.error?.message ?? "We could not create your account. Please try again.");
        return;
      }

      if (!body.user?.emailVerified) {
        setNotice({
          message: "Account created. Check your inbox for the verification link before starting a test.",
          verifyUrl: body.devVerificationUrl,
        });
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

  if (notice) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Account created">
          {notice.message}
        </Alert>
        {notice.verifyUrl ? (
          <Alert tone="warn" title="Development mode">
            Email delivery is not configured, so use this link to verify your address:{" "}
            <Link href={notice.verifyUrl} className="font-medium underline">
              Verify email now
            </Link>
          </Alert>
        ) : null}
        <Button onClick={() => router.push(nextPath)} className="w-full" size="lg">
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div>
        <Label htmlFor="displayName">Full name</Label>
        <Input id="displayName" name="displayName" autoComplete="name" required maxLength={80} />
        <FieldError>{fields.displayName}</FieldError>
      </div>
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" required minLength={3} maxLength={30} placeholder="lowercase_letters_and_underscores" />
        <FieldError>{fields.username}</FieldError>
      </div>
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <FieldError>{fields.email}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
          At least 8 characters with an uppercase letter, a lowercase letter and a number.
        </p>
        <FieldError>{fields.password}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="state">State (optional)</Label>
          <Select id="state" name="state" defaultValue="">
            <option value="">Prefer not to say</option>
            {INDIA_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="city">City (optional)</Label>
          <Input id="city" name="city" maxLength={80} />
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
        />
        <label htmlFor="acceptTerms" className="text-xs leading-5 text-ink-600 dark:text-ink-300">
          I agree to the{" "}
          <Link href="/terms" className="font-medium text-brand-600 underline dark:text-brand-300">
            Terms of Service
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="font-medium text-brand-600 underline dark:text-brand-300">
            Privacy Policy
          </Link>
          .
        </label>
      </div>
      <FieldError>{fields.acceptTerms}</FieldError>
      <Button type="submit" loading={busy} size="lg" className="w-full">
        Create free account
      </Button>
      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        Already registered?{" "}
        <Link
          href={`/login${nextPath !== "/dashboard" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
