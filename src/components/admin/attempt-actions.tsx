"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label, Modal } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

export function AttemptActions({
  attemptId,
  status,
  hasSession,
}: {
  attemptId: string;
  status: string;
  hasSession: boolean;
}) {
  const router = useRouter();
  const [invalidateOpen, setInvalidateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: "INVALIDATE" | "RELEASE_SESSION" | "RECALCULATE", extra?: Record<string, string>) => {
    if (action === "RELEASE_SESSION" && !window.confirm("Release the active session lock so the candidate can resume elsewhere?")) return;
    if (action === "RECALCULATE" && !window.confirm("Recalculate results for every attempt on this examination? This regrades the whole examination.")) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const result = await apiJson<Record<string, unknown>>(`/api/admin/attempts/${attemptId}`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      if (action === "RECALCULATE") {
        setNotice(`Recalculation finished: ${JSON.stringify(result)}`);
      } else {
        setNotice(action === "INVALIDATE" ? "Attempt invalidated." : "Session released.");
      }
      setInvalidateOpen(false);
      setReason("");
      router.refresh();
    } catch (runError) {
      setError(errorMessage(runError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {hasSession ? (
          <Button variant="secondary" size="sm" loading={busy === "RELEASE_SESSION"} disabled={busy !== null} onClick={() => void run("RELEASE_SESSION")}>
            Release session lock
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" loading={busy === "RECALCULATE"} disabled={busy !== null} onClick={() => void run("RECALCULATE")}>
          Recalculate exam results
        </Button>
        {status !== "INVALIDATED" ? (
          <Button variant="danger" size="sm" disabled={busy !== null} onClick={() => setInvalidateOpen(true)}>
            Invalidate attempt
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-danger-600 dark:text-danger-500">{error}</p> : null}
      {notice ? <p className="max-w-md text-right text-xs text-success-600 dark:text-success-500">{notice}</p> : null}

      <Modal
        open={invalidateOpen}
        onClose={() => setInvalidateOpen(false)}
        title="Invalidate attempt"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInvalidateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "INVALIDATE"}
              disabled={reason.trim().length < 3}
              onClick={() => void run("INVALIDATE", { reason: reason.trim() })}
            >
              Invalidate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Invalidation removes this attempt from scoring and rankings. It remains visible in the audit trail and can be
          reviewed later.
        </p>
        <div className="mt-3">
          <Label htmlFor="invalidate-reason">Reason (recorded)</Label>
          <Input
            id="invalidate-reason"
            value={reason}
            minLength={3}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Confirmed device sharing during the exam window"
          />
        </div>
      </Modal>
    </div>
  );
}
