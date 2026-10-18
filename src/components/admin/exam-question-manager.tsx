"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Modal,
  ProgressBar,
  SearchInput,
  Select,
  Table,
  Td,
  Th,
  difficultyTone,
} from "@/components/ui";
import { apiJson, errorMessage, type Meta } from "@/components/admin/api";

type SectionInfo = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  questionCount: number;
};

type AssignedRow = {
  questionId: string;
  text: string;
  subject: string;
  difficulty: string;
  sectionId: string | null;
  sectionTitle: string | null;
  isDefective: boolean;
};

type Candidate = {
  id: string;
  text: string;
  difficulty: string;
  subject: string;
  topic: string | null;
};

export function ExamQuestionManager({
  examId,
  sections,
  assigned,
  attemptsExist,
  canMarkDefective,
  meta,
}: {
  examId: string;
  sections: SectionInfo[];
  assigned: AssignedRow[];
  attemptsExist: boolean;
  canMarkDefective: boolean;
  meta: Meta;
}) {
  const router = useRouter();
  const [targetSectionId, setTargetSectionId] = useState(sections[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesTotal, setCandidatesTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [defectiveTarget, setDefectiveTarget] = useState<AssignedRow | null>(null);
  const [defectiveReason, setDefectiveReason] = useState("");

  const targetSection = sections.find((section) => section.id === targetSectionId) ?? null;
  const subjectFilter = targetSection?.subjectId ?? "";

  const loadCandidates = useCallback(
    async (subjectId: string, query: string) => {
      if (!subjectId) {
        setCandidates([]);
        setCandidatesTotal(0);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: "PUBLISHED", subjectId, pageSize: "25" });
        if (query.trim()) params.set("search", query.trim());
        const result = await apiJson<{ total: number; questions: Candidate[] }>(`/api/admin/questions?${params.toString()}`);
        setCandidates(result.questions);
        setCandidatesTotal(result.total);
      } catch (loadError) {
        setError(errorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => void loadCandidates(subjectFilter, search), 300);
    return () => window.clearTimeout(handle);
  }, [subjectFilter, search, loadCandidates]);

  const toggleSelected = (questionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const assign = async () => {
    if (!targetSection || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiJson<{ assigned: number }>(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify({ action: "ASSIGN", sectionId: targetSection.id, questionIds: [...selected] }),
      });
      setNotice(`${result.assigned} question(s) assigned to “${targetSection.title}”.`);
      setSelected(new Set());
      router.refresh();
    } catch (assignError) {
      setError(errorMessage(assignError));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (questionId: string) => {
    const sectionId = sections[0]?.id;
    if (!sectionId) return;
    if (!window.confirm("Remove this question from the examination?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson(`/api/admin/exams/${examId}/questions`, {
        method: "POST",
        body: JSON.stringify({ action: "UNASSIGN", sectionId, questionIds: [questionId] }),
      });
      router.refresh();
    } catch (unassignError) {
      setError(errorMessage(unassignError));
    } finally {
      setBusy(false);
    }
  };

  const submitDefective = async () => {
    if (!defectiveTarget) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson(`/api/admin/exams/${examId}/questions/${defectiveTarget.questionId}/defective`, {
        method: "POST",
        body: JSON.stringify({ defective: !defectiveTarget.isDefective, reason: defectiveReason.trim() }),
      });
      setNotice(
        defectiveTarget.isDefective
          ? "Question restored to scoring. Affected results were regraded."
          : "Question marked defective and excluded from scoring. Affected results were regraded.",
      );
      setDefectiveTarget(null);
      setDefectiveReason("");
      router.refresh();
    } catch (defectiveError) {
      setError(errorMessage(defectiveError));
    } finally {
      setBusy(false);
    }
  };

  const assignedBySection = new Map<string, number>();
  for (const row of assigned) {
    if (row.sectionId) assignedBySection.set(row.sectionId, (assignedBySection.get(row.sectionId) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader
        title="Question pool"
        description={
          attemptsExist
            ? "Attempts exist, so questions can no longer be removed — mark defective or create a new version instead."
            : "Assign published questions to sections, then activate the examination."
        }
      />
      <CardBody className="space-y-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {sections.map((section) => {
            const linked = assignedBySection.get(section.id) ?? 0;
            return (
              <div key={section.id} className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
                <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{section.title}</p>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                  {section.subjectName} · {linked} of {section.questionCount} questions linked
                </p>
                <ProgressBar className="mt-2" value={linked} max={section.questionCount} />
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-ink-200 p-3 dark:border-ink-800">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="assign-section">Assign into section</Label>
              <Select id="assign-section" value={targetSectionId} onChange={(event) => setTargetSectionId(event.target.value)}>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title} ({section.subjectName})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="assign-search">Search published {targetSection ? targetSection.subjectName : ""} questions</Label>
              <SearchInput
                id="assign-search"
                placeholder="Filter by text…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button onClick={() => void assign()} disabled={selected.size === 0 || busy} loading={busy}>
              <Plus className="h-4 w-4" aria-hidden />
              Assign {selected.size > 0 ? `${selected.size} selected` : "selected"}
            </Button>
          </div>

          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
            {loading ? "Searching…" : `${candidates.length} shown of ${candidatesTotal} matching published question(s).`} Only
            published questions can be assigned, and every question in a section must belong to its subject.
          </p>

          {candidates.length > 0 ? (
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-ink-100 p-1 dark:border-ink-800">
              {candidates.map((candidate) => {
                const already = assigned.some((row) => row.questionId === candidate.id);
                return (
                  <label
                    key={candidate.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-800/60"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600"
                      checked={selected.has(candidate.id)}
                      disabled={already}
                      onChange={() => toggleSelected(candidate.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-800 dark:text-ink-100">{candidate.text}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                        <Badge tone={difficultyTone(candidate.difficulty)}>{candidate.difficulty.toLowerCase()}</Badge>
                        {candidate.topic ? <span>{candidate.topic}</span> : null}
                        {already ? <span className="text-success-600 dark:text-success-500">already assigned</span> : null}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : !loading && subjectFilter ? (
            <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
              No published {search ? "matching " : ""}questions for this subject.
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-800 dark:text-ink-100">Assigned questions ({assigned.length})</p>
          {assigned.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No questions assigned yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Question</Th>
                  <Th>Section</Th>
                  <Th>Difficulty</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {assigned.map((row) => (
                  <tr key={row.questionId}>
                    <Td className="max-w-md">
                      <span className="block truncate">{row.text}</span>
                    </Td>
                    <Td className="text-xs">
                      {row.sectionTitle ?? "—"} <span className="text-ink-400">({row.subject})</span>
                    </Td>
                    <Td>
                      <Badge tone={difficultyTone(row.difficulty)}>{row.difficulty.toLowerCase()}</Badge>
                    </Td>
                    <Td>
                      {row.isDefective ? (
                        <Badge tone="danger">defective</Badge>
                      ) : (
                        <Badge tone="success">scoring</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-1">
                        {canMarkDefective ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={row.isDefective ? "Restore to scoring" : "Mark defective (regrades results)"}
                            onClick={() => {
                              setDefectiveTarget(row);
                              setDefectiveReason(row.isDefective ? "Restored to active scoring" : "");
                            }}
                          >
                            {row.isDefective ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                          </Button>
                        ) : null}
                        {!attemptsExist ? (
                          <Button variant="ghost" size="sm" title="Remove from examination" onClick={() => void unassign(row.questionId)} disabled={busy}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </CardBody>

      <Modal
        open={defectiveTarget !== null}
        onClose={() => setDefectiveTarget(null)}
        title={defectiveTarget?.isDefective ? "Restore question to scoring" : "Mark question defective"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDefectiveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={defectiveTarget?.isDefective ? "success" : "danger"}
              loading={busy}
              disabled={defectiveReason.trim().length < 3}
              onClick={() => void submitDefective()}
            >
              {defectiveTarget?.isDefective ? "Restore" : "Mark defective & regrade"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          {defectiveTarget?.isDefective
            ? "This question will count towards scoring again and every affected result will be regraded."
            : "This question will be excluded from scoring across the whole examination and every affected result will be regraded. This is recorded in the audit log."}
        </p>
        <div className="mt-3">
          <Label htmlFor="defective-reason">Reason (recorded in the audit log)</Label>
          <Input
            id="defective-reason"
            value={defectiveReason}
            minLength={3}
            maxLength={500}
            onChange={(event) => setDefectiveReason(event.target.value)}
            placeholder="e.g. Ambiguous wording confirmed by reviewer"
          />
        </div>
      </Modal>
    </Card>
  );
}
