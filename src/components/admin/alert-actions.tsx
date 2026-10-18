"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Label, Modal, Textarea } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

export function AlertActions({ alertId, alertType }: { alertId: string; alertType: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"RESOLVE" | "DISMISS" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (action: "RESOLVE" | "DISMISS") => {
    setBusy(action);
    setError(null);
    try {
      await apiJson(`/api/admin/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (reviewError) {
      setError(errorMessage(reviewError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Review
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Review alert: ${alertType.replaceAll("_", " ").toLowerCase()}`}
        footer={
          <>
            <Button variant="ghost" loading={busy === "DISMISS"} disabled={busy !== null} onClick={() => void review("DISMISS")}>
              Dismiss
            </Button>
            <Button variant="success" loading={busy === "RESOLVE"} disabled={busy !== null} onClick={() => void review("RESOLVE")}>
              Resolve
            </Button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="mb-3 rounded-lg border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-600 dark:bg-danger-500/10 dark:text-danger-500">
            {error}
          </p>
        ) : null}
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Alerts are advisory signals with recorded evidence, never automatic penalties. Your decision and note become part
          of the audit trail.
        </p>
        <div className="mt-3">
          <Label htmlFor="alert-note">Resolution note (optional, recorded)</Label>
          <Textarea
            id="alert-note"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Verified with candidate — network drop during the test."
          />
        </div>
      </Modal>
    </>
  );
}
