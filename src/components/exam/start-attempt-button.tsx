"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { Play } from "lucide-react";

type Props = {
  examId: string;
  examSlug: string;
  signedIn: boolean;
  disabled?: boolean;
  disabledReason?: string;
  size?: "md" | "lg";
  label?: string;
};

export function StartAttemptButton({
  examId,
  examSlug,
  signedIn,
  disabled = false,
  disabledReason,
  size = "lg",
  label = "Start test",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/mock-tests/${examSlug}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const body = (await response.json()) as { attemptId?: string; error?: { message: string } };
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/mock-tests/${examSlug}`)}`);
        return;
      }
      if (!response.ok || !body.attemptId) {
        setError(body.error?.message ?? "We could not start this test. Please try again.");
        return;
      }
      router.push(`/attempt/${body.attemptId}`);
    } catch {
      setError("Network problem - check your connection and try again. If the test started, it is safe to resume.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button onClick={start} loading={busy} disabled={disabled} size={size}>
        {!busy ? <Play className="h-4 w-4" aria-hidden /> : null}
        {label}
      </Button>
      {disabled && disabledReason ? (
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">{disabledReason}</p>
      ) : null}
      {error ? (
        <Alert tone="danger" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
