import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ExamCard, type ExamCardData } from "@/components/exam-card";
import { EmptyState, SearchInput, buttonClass, cn } from "@/components/ui";
import { DIFFICULTIES } from "@/lib/constants";
import { getExamParticipationStats } from "@/lib/leaderboard";
import { FileSearch } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mock tests",
  description:
    "Browse timed computer-based mock tests for NEET, JEE Main, SSC, banking, railway and CUET - with instant scoring and practice rankings.",
};

type SearchParams = Promise<{ category?: string; difficulty?: string; q?: string }>;

export default async function MockTestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const categorySlug = params.category?.trim() || undefined;
  const difficulty = Object.keys(DIFFICULTIES).includes(params.difficulty ?? "") ? params.difficulty : undefined;
  const search = params.q?.trim() || undefined;

  const [categories, exams] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.exam.findMany({
      where: {
        status: "ACTIVE",
        ...(difficulty ? { difficulty } : {}),
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } },
                { category: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { difficulty: "asc" }],
      include: { category: true, _count: { select: { questions: true } } },
    }),
  ]);

  const stats = await getExamParticipationStats(exams.map((exam) => exam.id));
  const cards: ExamCardData[] = exams.map((exam) => ({
    slug: exam.slug,
    title: exam.title,
    description: exam.description,
    categoryName: exam.category.name,
    difficulty: exam.difficulty,
    durationMinutes: exam.durationMinutes,
    marksPerCorrect: exam.marksPerCorrect,
    negativeMarksPerWrong: exam.negativeMarksPerWrong,
    questionCount: exam._count.questions,
    participants: stats.get(exam.id)?.participants ?? 0,
    averagePercentage: stats.get(exam.id)?.averagePercentage,
  }));

  const buildHref = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { category: categorySlug, difficulty, q: search, ...updates };
    for (const [key, value] of Object.entries(merged)) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/mock-tests?${query}` : "/mock-tests";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Mock tests</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          Every test is timed and scored by the server under the marking scheme shown on its card. Pick a category and
          difficulty, read the instructions, then begin when ready.
        </p>
      </header>

      <form action="/mock-tests" method="get" role="search" className="mt-6 flex flex-wrap items-center gap-3">
        <SearchInput
          name="q"
          placeholder="Search tests, e.g. NEET biology"
          defaultValue={search}
          className="w-full sm:w-72"
          aria-label="Search mock tests"
        />
        {categorySlug ? <input type="hidden" name="category" value={categorySlug} /> : null}
        {difficulty ? <input type="hidden" name="difficulty" value={difficulty} /> : null}
        <button type="submit" className={buttonClass("secondary", "md")}>
          Search
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter by examination">
        <Link href={buildHref({ category: undefined })} className={filterClass(!categorySlug)}>
          All examinations
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={buildHref({ category: category.slug })}
            className={filterClass(categorySlug === category.slug)}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter by difficulty">
        <Link href={buildHref({ difficulty: undefined })} className={filterClass(!difficulty)}>
          All difficulties
        </Link>
        {Object.entries(DIFFICULTIES).map(([key, value]) => (
          <Link key={key} href={buildHref({ difficulty: value })} className={filterClass(difficulty === value)}>
            {key[0] + key.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<FileSearch className="h-8 w-8" aria-hidden />}
            title="No mock tests match these filters"
            description="Try a different examination, difficulty or search term."
            action={
              <Link href="/mock-tests" className={buttonClass("secondary", "md")}>
                Clear filters
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <p className="nums mt-6 text-xs text-ink-500 dark:text-ink-400">
            {cards.length} test{cards.length === 1 ? "" : "s"} available
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((exam) => (
              <ExamCard key={exam.slug} exam={exam} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function filterClass(active: boolean) {
  return cn(
    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
    active
      ? "border-brand-500 bg-brand-500 text-white"
      : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-300",
  );
}
