"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

type Action = "ACTIVATE" | "ARCHIVE" | "PUBLISH_RESULTS" | "UNPUBLISH_RESULTS";

const CONFIRMATIONS: Record<Action, () => string> = {
  ACTIVATE: () => "Activate this examination so candidates can start attempts?",
  ARCHIVE: () => "Archive this examination? Candidates will no longer be able to start it.",
  PUBLISH_RESULTS: () => "Publish results for every finalised attempt on this examination?",
  UNPUBLISH_RESULTS: () => "Unpublish results? Candidates will lose access to their scorecards until results are published again.",
};

export function ExamLifecycle({
  examId,
  status,
  questionsAssigned,
}: {
  examId: string;
  status: string;
  questionsAssigned: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: Action) => {
    if (!window.confirm(CONFIRMATIONS[action]())) return;
    setError(null);
    setBusy(action);
    try {
      await apiJson(`/api/admin/exams/${examId}/actions`, { method: "POST", body: JSON.stringify({ action }) });
      router.refresh();
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "ARCHIVED" || status === "DRAFT" || status === "SCHEDULED" ? (
          <Button
            size="sm"
            variant="success"
            loading={busy === "ACTIVATE"}
            disabled={questionsAssigned === 0 || busy !== null}
            title={questionsAssigned === 0 ? "Assign questions before activating" : undefined}
            onClick={() => void run("ACTIVATE")}
          >
            Activate
          </Button>
        ) : null}
        {status !== "ARCHIVED" ? (
          <Button size="sm" variant="secondary" loading={busy === "ARCHIVE"} disabled={busy !== null} onClick={() => void run("ARCHIVE")}>
            Archive
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" loading={busy === "PUBLISH_RESULTS"} disabled={busy !== null} onClick={() => void run("PUBLISH_RESULTS")}>
          Publish results
        </Button>
        <Button size="sm" variant="ghost" loading={busy === "UNPUBLISH_RESULTS"} disabled={busy !== null} onClick={() => void run("UNPUBLISH_RESULTS")}>
          Unpublish
        </Button>
      </div>
      {error ? (
        <Alert tone="danger" className="max-w-md">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
