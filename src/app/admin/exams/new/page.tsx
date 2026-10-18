import { prisma } from "@/lib/db";
import { ExamForm } from "@/components/admin/exam-form";

export const dynamic = "force-dynamic";

export default async function NewExamPage() {
  const [categories, subjects] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ include: { topics: true }, orderBy: { name: "asc" } }),
  ]);

  const meta = {
    categories: categories.map((category) => ({ id: category.id, name: category.name, slug: category.slug })),
    subjects: subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
      topics: subject.topics.map((topic) => ({ id: topic.id, name: topic.name })),
    })),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">New examination</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Define the paper structure and rules. You can refine everything later until candidates attempt it.
        </p>
      </div>
      {meta.categories.length === 0 || meta.subjects.length === 0 ? (
        <div className="rounded-xl border border-warn-500/30 bg-warn-50 p-4 text-sm text-warn-700 dark:bg-warn-500/10 dark:text-warn-400">
          Categories and subjects come from the seed data. Run <code>npm run db:seed</code> before creating examinations.
        </div>
      ) : (
        <ExamForm mode="create" meta={meta} />
      )}
    </div>
  );
}
