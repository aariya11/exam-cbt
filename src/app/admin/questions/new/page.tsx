import { prisma } from "@/lib/db";
import { QuestionForm } from "@/components/admin/question-form";

export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  const subjects = await prisma.subject.findMany({ include: { topics: true }, orderBy: { name: "asc" } });

  const meta = {
    categories: [],
    subjects: subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
      topics: subject.topics
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((topic) => ({ id: topic.id, name: topic.name })),
    })),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">New question</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Questions are created as drafts and move through review before they can be published.
        </p>
      </div>
      {meta.subjects.length === 0 ? (
        <div className="rounded-xl border border-warn-500/30 bg-warn-50 p-4 text-sm text-warn-700 dark:bg-warn-500/10 dark:text-warn-400">
          No subjects found. Run <code>npm run db:seed</code> first.
        </div>
      ) : (
        <QuestionForm mode="create" meta={meta} />
      )}
    </div>
  );
}
