"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, Input, Label, Select, Textarea } from "@/components/ui";
import { apiJson, errorMessage, type Meta } from "@/components/admin/api";

type OptionRow = { text: string; isCorrect: boolean };

export type QuestionFormInitial = {
  subjectId: string;
  topicId: string | null;
  difficulty: string;
  type: string;
  text: string;
  explanation: string;
  imageUrl: string;
  source: string;
  license: string;
  options: OptionRow[];
};

const DEFAULT_OPTIONS: OptionRow[] = [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuestionForm({
  mode,
  meta,
  questionId,
  initial,
}: {
  mode: "create" | "edit";
  meta: Meta;
  questionId?: string;
  initial?: QuestionFormInitial;
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuestionFormInitial>(
    initial ?? {
      subjectId: meta.subjects[0]?.id ?? "",
      topicId: null,
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: "",
      explanation: "",
      imageUrl: "",
      source: "",
      license: "",
      options: DEFAULT_OPTIONS.map((option) => ({ ...option })),
    },
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof QuestionFormInitial>(key: K, value: QuestionFormInitial[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const subjectTopics = meta.subjects.find((subject) => subject.id === form.subjectId)?.topics ?? [];
  const isSingle = form.type === "SINGLE_CHOICE";

  const updateOption = (index: number, patch: Partial<OptionRow>) =>
    setForm((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, ...patch } : option)),
    }));

  const setCorrect = (index: number) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, i) =>
        isSingle ? { ...option, isCorrect: i === index } : i === index ? { ...option, isCorrect: !option.isCorrect } : option,
      ),
    }));
  };

  const changeType = (type: string) => {
    setForm((current) => {
      let options = current.options;
      if (type === "SINGLE_CHOICE") {
        const firstCorrect = options.findIndex((option) => option.isCorrect);
        options = options.map((option, index) => ({ ...option, isCorrect: index === (firstCorrect >= 0 ? firstCorrect : 0) }));
      }
      return { ...current, type, options };
    });
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const payload = {
        subjectId: form.subjectId,
        topicId: form.topicId || null,
        difficulty: form.difficulty,
        type: form.type,
        text: form.text.trim(),
        explanation: form.explanation.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        source: form.source.trim() || null,
        license: form.license.trim() || null,
        options: form.options
          .map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
          .filter((option) => option.text.length > 0),
      };

      if (mode === "create") {
        const result = await apiJson<{ id: string }>("/api/admin/questions", { method: "POST", body: JSON.stringify(payload) });
        router.push(`/admin/questions/${result.id}`);
        router.refresh();
      } else {
        await apiJson(`/api/admin/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice("Saved. The previous version was archived to the version history and this question is back in draft review.");
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
      {error ? <Alert tone="danger" title="Could not save the question">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardHeader title="Classification" description="Where this question lives and how hard it is" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="question-subject">Subject</Label>
            <Select
              id="question-subject"
              value={form.subjectId}
              required
              onChange={(event) => {
                set("subjectId", event.target.value);
                set("topicId", null);
              }}
            >
              {meta.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="question-topic">Topic (optional)</Label>
            <Select
              id="question-topic"
              value={form.topicId ?? ""}
              onChange={(event) => set("topicId", event.target.value || null)}
              disabled={subjectTopics.length === 0}
            >
              <option value="">{subjectTopics.length === 0 ? "No topics for this subject" : "No topic"}</option>
              {subjectTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="question-difficulty">Difficulty</Label>
            <Select id="question-difficulty" value={form.difficulty} onChange={(event) => set("difficulty", event.target.value)}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="question-type">Type</Label>
            <Select id="question-type" value={form.type} onChange={(event) => changeType(event.target.value)}>
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTIPLE_CHOICE">Multiple choice (multi-select)</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Question & options" description={isSingle ? "Exactly one correct option" : "One or more correct options"} />
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="question-text">Question text</Label>
            <Textarea
              id="question-text"
              value={form.text}
              required
              minLength={3}
              maxLength={5000}
              onChange={(event) => set("text", event.target.value)}
              placeholder="Plain text. Optional LaTeX between $…$ is rendered with KaTeX."
            />
          </div>

          <div className="space-y-2">
            {form.options.map((option, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type={isSingle ? "radio" : "checkbox"}
                  name="correct-option"
                  checked={option.isCorrect}
                  onChange={() => setCorrect(index)}
                  aria-label={`Mark option ${index + 1} as correct`}
                  className="h-4 w-4 shrink-0 border-ink-300 text-brand-600"
                />
                <Input
                  value={option.text}
                  onChange={(event) => updateOption(index, { text: event.target.value })}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1} text`}
                />
                {form.options.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => setForm((current) => ({ ...current, options: current.options.filter((_, i) => i !== index) }))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
            {form.options.length < 6 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setForm((current) => ({ ...current, options: [...current.options, { text: "", isCorrect: false }] }))}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add option
              </Button>
            ) : null}
          </div>

          <div>
            <Label htmlFor="question-explanation">Explanation (shown with solutions)</Label>
            <Textarea
              id="question-explanation"
              value={form.explanation}
              maxLength={5000}
              onChange={(event) => set("explanation", event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="question-image">Image URL (optional)</Label>
            <Input
              id="question-image"
              type="url"
              value={form.imageUrl}
              maxLength={1000}
              onChange={(event) => set("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Provenance"
          description="Both fields are mandatory before a question can be published — we never publish content without a recorded source."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="question-source">Source</Label>
            <Input
              id="question-source"
              value={form.source}
              maxLength={300}
              onChange={(event) => set("source", event.target.value)}
              placeholder="e.g. Author-written for RankForge"
            />
          </div>
          <div>
            <Label htmlFor="question-license">Licence</Label>
            <Input
              id="question-license"
              value={form.license}
              maxLength={300}
              onChange={(event) => set("license", event.target.value)}
              placeholder="e.g. Original content — all rights reserved"
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {mode === "edit" ? (
          <p className="mr-auto max-w-xl text-xs text-ink-500 dark:text-ink-400">
            Editing archives an immutable snapshot of the current version, increments the version number and returns the
            question to the draft workflow. Published questions cannot be edited.
          </p>
        ) : null}
        <Button type="submit" loading={saving}>
          {mode === "create" ? "Create question" : "Save new version"}
        </Button>
      </div>
    </form>
  );
}
