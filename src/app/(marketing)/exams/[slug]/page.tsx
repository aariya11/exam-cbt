import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ExamCard, type ExamCardData } from "@/components/exam-card";
import { EmptyState, buttonClass } from "@/components/ui";
import { getExamParticipationStats } from "@/lib/leaderboard";
import { FileSearch } from "lucide-react";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug }, select: { name: true, description: true } });
  if (!category) return { title: "Examination not found" };
  return { title: category.name, description: category.description };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      exams: {
        where: { status: "ACTIVE" },
        orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
        include: { category: true, _count: { select: { questions: true } } },
      },
    },
  });
  if (!category || !category.active) notFound();

  const stats = await getExamParticipationStats(category.exams.map((exam) => exam.id));
  const cards: ExamCardData[] = category.exams.map((exam) => ({
    slug: exam.slug,
    title: exam.title,
    description: exam.description,
    categoryName: category.name,
    difficulty: exam.difficulty,
    durationMinutes: exam.durationMinutes,
    marksPerCorrect: exam.marksPerCorrect,
    negativeMarksPerWrong: exam.negativeMarksPerWrong,
    questionCount: exam._count.questions,
    participants: stats.get(exam.id)?.participants ?? 0,
    averagePercentage: stats.get(exam.id)?.averagePercentage,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-500 dark:text-ink-400">
        <Link href="/exams" className="hover:text-brand-600">
          Examinations
        </Link>
        <span className="mx-1.5">/</span>
        <span>{category.name}</span>
      </nav>
      <header className="mt-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">{category.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">{category.description}</p>
      </header>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<FileSearch className="h-8 w-8" aria-hidden />}
            title="No active tests in this category yet"
            description="New mock tests are added regularly. Browse the other examination categories in the meantime."
            action={
              <Link href="/mock-tests" className={buttonClass("secondary", "md")}>
                Browse all mock tests
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((exam) => (
            <ExamCard key={exam.slug} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}
