"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, Input, Label, Select, Textarea } from "@/components/ui";
import { TIE_BREAK_OPTIONS, type TieBreakRule } from "@/lib/constants";
import { apiJson, errorMessage, slugify, type Meta } from "@/components/admin/api";

export type ExamFormInitial = {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  difficulty: string;
  durationMinutes: number;
  marksPerCorrect: number;
  negativeMarksPerWrong: number;
  allowPartialCredit: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number | null;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  publishResultsImmediately: boolean;
  revealSolutions: boolean;
  requiresDesktop: boolean;
  maxFocusWarnings: number;
  tieBreakRules: string[];
  instructions: string | null;
  sections: Array<{ subjectId: string; title: string; questionCount: number }>;
};

type SectionRow = { subjectId: string; title: string; questionCount: number };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const DEFAULT_SECTION: SectionRow = { subjectId: "", title: "Section 1", questionCount: 10 };

export function ExamForm({
  mode,
  meta,
  examId,
  initial,
  sectionsLocked = false,
}: {
  mode: "create" | "edit";
  meta: Meta;
  examId?: string;
  initial?: ExamFormInitial;
  sectionsLocked?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? meta.categories[0]?.id ?? "",
    difficulty: initial?.difficulty ?? "MEDIUM",
    durationMinutes: initial?.durationMinutes ?? 60,
    marksPerCorrect: initial?.marksPerCorrect ?? 4,
    negativeMarksPerWrong: initial?.negativeMarksPerWrong ?? 1,
    allowPartialCredit: initial?.allowPartialCredit ?? false,
    shuffleQuestions: initial?.shuffleQuestions ?? true,
    shuffleOptions: initial?.shuffleOptions ?? true,
    maxAttempts: initial?.maxAttempts ?? null,
    status: initial?.status ?? "DRAFT",
    opensAt: toLocalInput(initial?.opensAt ?? null),
    closesAt: toLocalInput(initial?.closesAt ?? null),
    publishResultsImmediately: initial?.publishResultsImmediately ?? true,
    revealSolutions: initial?.revealSolutions ?? true,
    requiresDesktop: initial?.requiresDesktop ?? false,
    maxFocusWarnings: initial?.maxFocusWarnings ?? 5,
    tieBreakRules: (initial?.tieBreakRules ?? ["ACCURACY_DESC", "WRONG_ASC"]) as string[],
    instructions: initial?.instructions ?? "",
  });
  const [sections, setSections] = useState<SectionRow[]>(
    initial?.sections?.length ? initial.sections.map((s) => ({ ...s })) : [{ ...DEFAULT_SECTION }],
  );
  const [slugEdited, setSlugEdited] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleRule = (rule: TieBreakRule) => {
    set("tieBreakRules", form.tieBreakRules.includes(rule) ? form.tieBreakRules.filter((r) => r !== rule) : [...form.tieBreakRules, rule]);
  };

  const updateSection = (index: number, patch: Partial<SectionRow>) =>
    setSections((current) => current.map((section, i) => (i === index ? { ...section, ...patch } : section)));

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        difficulty: form.difficulty,
        durationMinutes: Number(form.durationMinutes),
        marksPerCorrect: Number(form.marksPerCorrect),
        negativeMarksPerWrong: Number(form.negativeMarksPerWrong),
        allowPartialCredit: form.allowPartialCredit,
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        maxAttempts: form.maxAttempts ? Number(form.maxAttempts) : null,
        status: form.status,
        opensAt: fromLocalInput(form.opensAt),
        closesAt: fromLocalInput(form.closesAt),
        publishResultsImmediately: form.publishResultsImmediately,
        revealSolutions: form.revealSolutions,
        requiresDesktop: form.requiresDesktop,
        maxFocusWarnings: Number(form.maxFocusWarnings),
        tieBreakRules: form.tieBreakRules,
        instructions: form.instructions.trim() || null,
      };

      if (mode === "create") {
        const result = await apiJson<{ id: string }>("/api/admin/exams", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            slug: slugify(form.slug || form.title),
            sections: sections.map((s) => ({ subjectId: s.subjectId, title: s.title.trim(), questionCount: Number(s.questionCount) })),
          }),
        });
        router.push(`/admin/exams/${result.id}`);
        router.refresh();
      } else {
        if (!sectionsLocked) {
          payload.sections = sections.map((s) => ({
            subjectId: s.subjectId,
            title: s.title.trim(),
            questionCount: Number(s.questionCount),
          }));
        }
        await apiJson(`/api/admin/exams/${examId}`, { method: "PATCH", body: JSON.stringify(payload) });
        router.refresh();
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-6"
    >
      {error ? <Alert tone="danger" title="Could not save">{error}</Alert> : null}

      <Card>
        <CardHeader title="Basics" description="Candidate-facing identity of the examination" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="exam-title">Title</Label>
            <Input
              id="exam-title"
              value={form.title}
              required
              minLength={3}
              maxLength={150}
              onChange={(event) => {
                set("title", event.target.value);
                if (!slugEdited && mode === "create") set("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="exam-slug">Slug {mode === "edit" ? "(locked)" : ""}</Label>
            <Input
              id="exam-slug"
              value={form.slug}
              required
              disabled={mode === "edit"}
              pattern="[a-z0-9-]+"
              onChange={(event) => {
                setSlugEdited(true);
                set("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div>
            <Label htmlFor="exam-category">Category</Label>
            <Select id="exam-category" value={form.categoryId} required onChange={(event) => set("categoryId", event.target.value)}>
              {meta.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exam-description">Description</Label>
            <Textarea
              id="exam-description"
              value={form.description}
              required
              minLength={10}
              maxLength={2000}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exam-instructions">Instructions shown on the start screen (optional)</Label>
            <Textarea id="exam-instructions" value={form.instructions} maxLength={5000} onChange={(event) => set("instructions", event.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Rules & scoring" description="Marks, timing, shuffling and tie-breaks" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="exam-difficulty">Difficulty</Label>
            <Select id="exam-difficulty" value={form.difficulty} onChange={(event) => set("difficulty", event.target.value)}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="exam-duration">Duration (minutes)</Label>
            <Input
              id="exam-duration"
              type="number"
              min={1}
              max={360}
              value={form.durationMinutes}
              onChange={(event) => set("durationMinutes", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="exam-marks">Marks per correct</Label>
            <Input
              id="exam-marks"
              type="number"
              step="0.25"
              min={0}
              max={100}
              value={form.marksPerCorrect}
              onChange={(event) => set("marksPerCorrect", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="exam-negative">Negative marks per wrong</Label>
            <Input
              id="exam-negative"
              type="number"
              step="0.25"
              min={0}
              max={100}
              value={form.negativeMarksPerWrong}
              onChange={(event) => set("negativeMarksPerWrong", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="exam-max-attempts">Max attempts (blank = unlimited)</Label>
            <Input
              id="exam-max-attempts"
              type="number"
              min={1}
              max={100}
              value={form.maxAttempts ?? ""}
              onChange={(event) => set("maxAttempts", event.target.value ? Number(event.target.value) : null)}
            />
          </div>
          <div>
            <Label htmlFor="exam-focus">Max focus warnings</Label>
            <Input
              id="exam-focus"
              type="number"
              min={0}
              max={100}
              value={form.maxFocusWarnings}
              onChange={(event) => set("maxFocusWarnings", Number(event.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="exam-opens">Opens at (optional)</Label>
            <Input id="exam-opens" type="datetime-local" value={form.opensAt} onChange={(event) => set("opensAt", event.target.value)} />
          </div>
          <div>
            <Label htmlFor="exam-closes">Closes at (optional)</Label>
            <Input id="exam-closes" type="datetime-local" value={form.closesAt} onChange={(event) => set("closesAt", event.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-2">
            <Label>Question options</Label>
            {(
              [
                ["shuffleQuestions", "Shuffle question order per candidate"],
                ["shuffleOptions", "Shuffle option order per candidate"],
                ["allowPartialCredit", "Allow partial credit on multi-select questions"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  checked={form[key]}
                  onChange={(event) => set(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-2">
            <Label>Results & integrity</Label>
            {(
              [
                ["publishResultsImmediately", "Publish results as soon as each attempt is finalised"],
                ["revealSolutions", "Reveal correct answers after results are published"],
                ["requiresDesktop", "Require a desktop/laptop (recommended for full-screen mode)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  checked={form[key]}
                  onChange={(event) => set(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <Label>Tie-break order (applied in the order ticked; score is always first)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(TIE_BREAK_OPTIONS) as TieBreakRule[]).map((rule) => (
                <label key={rule} className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600"
                    checked={form.tieBreakRules.includes(rule)}
                    onChange={() => toggleRule(rule)}
                  />
                  {TIE_BREAK_OPTIONS[rule]}
                </label>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Sections"
          description={
            sectionsLocked
              ? "Questions are already assigned, so sections are locked. Create a new examination version to restructure."
              : "Each section draws questions from a single subject"
          }
          action={
            sectionsLocked ? null : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSections((current) => [...current, { subjectId: "", title: `Section ${current.length + 1}`, questionCount: 10 }])}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add section
              </Button>
            )
          }
        />
        <CardBody className="space-y-3">
          {sections.map((section, index) => (
            <div key={index} className="grid gap-3 rounded-lg border border-ink-200 p-3 sm:grid-cols-[1.2fr_1.2fr_110px_auto] dark:border-ink-800">
              <div>
                <Label htmlFor={`section-subject-${index}`}>Subject</Label>
                <Select
                  id={`section-subject-${index}`}
                  value={section.subjectId}
                  required
                  disabled={sectionsLocked}
                  onChange={(event) => updateSection(index, { subjectId: event.target.value })}
                >
                  <option value="">Choose a subject…</option>
                  {meta.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`section-title-${index}`}>Section title</Label>
                <Input
                  id={`section-title-${index}`}
                  value={section.title}
                  required
                  disabled={sectionsLocked}
                  onChange={(event) => updateSection(index, { title: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`section-count-${index}`}>Questions</Label>
                <Input
                  id={`section-count-${index}`}
                  type="number"
                  min={1}
                  max={200}
                  value={section.questionCount}
                  disabled={sectionsLocked}
                  onChange={(event) => updateSection(index, { questionCount: Number(event.target.value) })}
                />
              </div>
              <div className="flex items-end">
                {!sectionsLocked && sections.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove section ${index + 1}`}
                    onClick={() => setSections((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {mode === "create" ? (
          <p className="mr-auto text-xs text-ink-500 dark:text-ink-400">
            The examination is created as a draft. Assign and publish questions before activating it.
          </p>
        ) : null}
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Create examination" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
