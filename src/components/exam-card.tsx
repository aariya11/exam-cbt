import Link from "next/link";
import { Badge, Card, difficultyTone } from "@/components/ui";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/constants";
import { formatClock, formatPercent } from "@/lib/format";
import { Clock3, ListChecks, Users } from "lucide-react";

export type ExamCardData = {
  slug: string;
  title: string;
  description: string;
  categoryName: string;
  difficulty: string;
  durationMinutes: number;
  marksPerCorrect: number;
  negativeMarksPerWrong: number;
  questionCount: number;
  participants: number;
  averagePercentage?: number;
};

export function ExamCard({ exam }: { exam: ExamCardData }) {
  const marking =
    exam.negativeMarksPerWrong > 0
      ? `+${exam.marksPerCorrect} / −${exam.negativeMarksPerWrong}`
      : `+${exam.marksPerCorrect} / 0`;

  return (
    <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
          {exam.categoryName}
        </p>
        <Badge tone={difficultyTone(exam.difficulty)}>
          {DIFFICULTY_LABELS[exam.difficulty as Difficulty] ?? exam.difficulty}
        </Badge>
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-ink-950 dark:text-ink-50">
        <Link href={`/mock-tests/${exam.slug}`} className="hover:text-brand-600 dark:hover:text-brand-300">
          {exam.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-ink-500 dark:text-ink-400">{exam.description}</p>
      <dl className="nums mt-4 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3.5 text-xs dark:border-ink-800">
        <div>
          <dt className="flex items-center gap-1 text-ink-400 dark:text-ink-500">
            <Clock3 className="h-3.5 w-3.5" aria-hidden /> Duration
          </dt>
          <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{formatClock(exam.durationMinutes * 60)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-ink-400 dark:text-ink-500">
            <ListChecks className="h-3.5 w-3.5" aria-hidden /> Questions
          </dt>
          <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{exam.questionCount}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-ink-400 dark:text-ink-500">
            <Users className="h-3.5 w-3.5" aria-hidden /> Taken
          </dt>
          <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{exam.participants}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between">
        <span className="nums text-xs text-ink-500 dark:text-ink-400">
          Marking {marking}
          {exam.averagePercentage !== undefined ? ` · avg ${formatPercent(exam.averagePercentage)}` : ""}
        </span>
        <Link
          href={`/mock-tests/${exam.slug}`}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          View details →
        </Link>
      </div>
    </Card>
  );
}
