"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; email: string }
  | { status: "error"; message: string };

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<State>(token ? { status: "working" } : { status: "idle" });
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const verify = useCallback(async (value: string) => {
    setState({ status: "working" });
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const body = (await response.json()) as { email?: string; error?: { message: string } };
      if (!response.ok) {
        setState({ status: "error", message: body.error?.message ?? "Verification failed." });
        return;
      }
      setState({ status: "done", email: body.email ?? "" });
    } catch {
      setState({ status: "error", message: "Network problem while verifying. Check your connection and open the link again." });
    }
  }, []);

  useEffect(() => {
    if (token) void verify(token);
  }, [token, verify]);

  const resend = async () => {
    setResendBusy(true);
    setResendMessage(null);
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const body = (await response.json()) as { message?: string; devVerificationUrl?: string; error?: { message: string } };
      if (!response.ok) {
        setResendMessage(body.error?.message ?? "We could not send a new link right now.");
        return;
      }
      setResendMessage(
        body.devVerificationUrl
          ? `Development mode: open ${body.devVerificationUrl} to verify.`
          : (body.message ?? "If verification is still pending, a new link has been sent."),
      );
    } catch {
      setResendMessage("Network problem - try again in a moment.");
    } finally {
      setResendBusy(false);
    }
  };

  if (state.status === "working") {
    return <Alert tone="info">Verifying your email address…</Alert>;
  }

  if (state.status === "done") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Email verified">
          {state.email ? `${state.email} is confirmed. ` : ""}You can now start any mock test on RankForge.
        </Alert>
        <Link
          href="/dashboard"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <Alert tone="danger" title="We could not verify that link">
          {state.message}
        </Alert>
        <Button variant="secondary" className="w-full" onClick={resend} loading={resendBusy}>
          Send me a new verification link
        </Button>
        {resendMessage ? <p className="text-xs text-ink-500 dark:text-ink-400">{resendMessage}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-ink-500 dark:text-ink-400">
        Open the verification link from your email to confirm your address. If you no longer have it, request a new one.
      </p>
      <Button className="w-full" onClick={resend} loading={resendBusy}>
        Send verification link
      </Button>
      {resendMessage ? <p className="text-xs text-ink-500 dark:text-ink-400">{resendMessage}</p> : null}
    </div>
  );
}
