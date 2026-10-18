"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { apiJson, errorMessage } from "@/components/admin/api";

const TRANSITIONS: Record<string, Array<{ to: string; label: string; variant: "secondary" | "success" | "ghost"; adminOnly?: boolean }>> = {
  DRAFT: [
    { to: "IN_REVIEW", label: "Send to review", variant: "secondary" },
    { to: "RETIRED", label: "Retire", variant: "ghost" },
  ],
  IN_REVIEW: [
    { to: "DRAFT", label: "Back to draft", variant: "ghost" },
    { to: "APPROVED", label: "Approve", variant: "success" },
    { to: "RETIRED", label: "Retire", variant: "ghost" },
  ],
  APPROVED: [
    { to: "PUBLISHED", label: "Publish", variant: "success", adminOnly: true },
    { to: "IN_REVIEW", label: "Back to review", variant: "ghost" },
    { to: "RETIRED", label: "Retire", variant: "ghost" },
  ],
  PUBLISHED: [{ to: "RETIRED", label: "Retire", variant: "ghost" }],
  RETIRED: [],
};

export function QuestionActions({
  questionId,
  status,
  isAdmin,
}: {
  questionId: string;
  status: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transitions = TRANSITIONS[status] ?? [];
  if (transitions.length === 0) return <span className="text-xs text-ink-400">—</span>;

  const move = async (to: string) => {
    if (to === "RETIRED" && !window.confirm("Retire this question? It can no longer be assigned to examinations.")) return;
    setError(null);
    setBusy(to);
    try {
      await apiJson(`/api/admin/questions/${questionId}/status`, { method: "POST", body: JSON.stringify({ status: to }) });
      router.refresh();
    } catch (moveError) {
      setError(errorMessage(moveError));
      window.alert(errorMessage(moveError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {transitions.map((transition) => (
        <Button
          key={transition.to}
          variant={transition.variant}
          size="sm"
          loading={busy === transition.to}
          disabled={(transition.adminOnly && !isAdmin) || busy !== null}
          title={transition.adminOnly && !isAdmin ? "Only administrators can publish questions" : undefined}
          onClick={() => void move(transition.to)}
        >
          {transition.label}
        </Button>
      ))}
      {error ? <span className="sr-only">{error}</span> : null}
    </span>
  );
}
