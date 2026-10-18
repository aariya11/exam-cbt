"use client";

import { cn } from "@/components/ui";
import type { AttemptAnswerState, RunnerQuestion } from "@/lib/attempt-view";
import { CircleDot } from "lucide-react";

export type PaletteStatus = "answered" | "marked" | "answered-marked" | "visited" | "untouched";

export function paletteStatus(question: RunnerQuestion, answer: AttemptAnswerState | undefined): PaletteStatus {
  const answered = Boolean(answer && answer.selectedOptionIds.length > 0);
  const marked = Boolean(answer?.markedForReview);
  if (answered && marked) return "answered-marked";
  if (marked) return "marked";
  if (answered) return "answered";
  if (answer?.visited) return "visited";
  return "untouched";
}

const statusClasses: Record<PaletteStatus, string> = {
  answered: "bg-success-500 text-white hover:bg-success-600",
  marked: "bg-warn-500 text-white hover:bg-warn-600",
  "answered-marked": "bg-success-600 text-white ring-2 ring-warn-500 hover:bg-success-600",
  visited: "bg-danger-500 text-white hover:bg-danger-600",
  untouched: "bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700",
};

const legend: { status: PaletteStatus; label: string }[] = [
  { status: "answered", label: "Answered" },
  { status: "visited", label: "Visited, not answered" },
  { status: "marked", label: "Marked for review" },
  { status: "answered-marked", label: "Answered & marked" },
  { status: "untouched", label: "Not visited" },
];

export function PaletteLegend() {
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-xs text-ink-600 sm:grid-cols-2 dark:text-ink-300">
      {legend.map((item) => (
        <li key={item.status} className="flex items-center gap-2">
          <span className={cn("h-3.5 w-3.5 shrink-0 rounded", statusClasses[item.status])} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function QuestionPalette({
  questions,
  answers,
  currentIndex,
  onSelect,
  sectionFilter,
}: {
  questions: RunnerQuestion[];
  answers: Record<string, AttemptAnswerState>;
  currentIndex: number;
  onSelect: (index: number) => void;
  sectionFilter: string | null;
}) {
  const visible = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => (sectionFilter ? question.sectionId === sectionFilter : true));

  return (
    <div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
        {visible.map(({ question, index }) => {
          const status = paletteStatus(question, answers[question.questionId]);
          const current = index === currentIndex;
          return (
            <button
              key={question.questionId}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Question ${question.order}, ${status.replace("-", " ")}, ${question.marks > 0 ? `plus ${question.marks} marks` : ""}`}
              aria-current={current ? "true" : undefined}
              className={cn(
                "nums relative flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                statusClasses[status],
                current && "ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-ink-950",
              )}
            >
              {question.order}
              {status === "answered-marked" ? (
                <CircleDot className="absolute -right-1 -top-1 h-3 w-3 text-warn-500" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
