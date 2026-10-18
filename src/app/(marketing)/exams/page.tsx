import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Examinations",
  description: "Examination categories covered by RankForge mock tests: NEET, JEE Main, SSC, banking, railway and CUET.",
};

export default async function ExamsPage() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { exams: { where: { status: "ACTIVE" } } } },
      series: { select: { id: true, name: true, slug: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Examinations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500 dark:text-ink-400">
          Choose your examination to see the mock tests available, the subjects covered and the marking scheme used.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Card key={category.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-950 dark:text-ink-50">{category.name}</h2>
              <span className="nums shrink-0 rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                {category._count.exams} active
              </span>
            </div>
            <p className="mt-2 flex-1 text-xs leading-5 text-ink-500 dark:text-ink-400">{category.description}</p>
            {category.series.length > 0 ? (
              <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
                Series: {category.series.map((series) => series.name).join(", ")}
              </p>
            ) : null}
            <Link
              href={`/exams/${category.slug}`}
              className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300"
            >
              View tests →
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
