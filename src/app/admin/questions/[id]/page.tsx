import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, CardHeader, statusTone } from "@/components/ui";
import { QuestionForm } from "@/components/admin/question-form";
import { QuestionActions } from "@/components/admin/question-actions";

export const dynamic = "force-dynamic";

export default async function AdminQuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      subject: true,
      topic: true,
      options: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { username: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 10,
      },
    },
  });
  if (!question) notFound();

  const editorIds = [...new Set(question.versions.map((version) => version.editedById))];
  const editors = editorIds.length
    ? await prisma.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, username: true } })
    : [];
  const editorNames = new Map(editors.map((editor) => [editor.id, editor.username]));

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

  const isAdmin = isAtLeastRole(user.role, ROLES.ADMIN);
  const locked = question.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Edit question</h1>
            <Badge tone={statusTone(question.status)}>{question.status.replaceAll("_", " ").toLowerCase()}</Badge>
            <Badge tone="neutral">v{question.version}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {question.subject.name}
            {question.topic ? ` · ${question.topic.name}` : ""} · created by {question.createdBy.username} · updated{" "}
            {formatDateTime(question.updatedAt)}
          </p>
        </div>
        <QuestionActions questionId={question.id} status={question.status} isAdmin={isAdmin} />
      </div>

      {locked ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100">
          This question is published and immutable — past candidates were graded against exactly this content. To change
          it, retire it and create a new question (or new exam version) instead.
        </div>
      ) : null}

      <QuestionForm
        mode="edit"
        meta={meta}
        questionId={question.id}
        initial={{
          subjectId: question.subjectId,
          topicId: question.topicId,
          difficulty: question.difficulty,
          type: question.type,
          text: question.text,
          explanation: question.explanation ?? "",
          imageUrl: question.imageUrl ?? "",
          source: question.source ?? "",
          license: question.license ?? "",
          options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
        }}
      />

      <Card>
        <CardHeader title="Version history" description="Immutable snapshots captured before each edit" />
        <div className="px-5 py-4">
          {question.versions.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No previous versions. This is the original.</p>
          ) : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {question.versions.map((version) => (
                <li key={version.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm text-ink-800 dark:text-ink-100">Version {version.version}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      superseded by {editorNames.get(version.editedById) ?? "a staff member"}
                    </p>
                  </div>
                  <span className="nums text-xs text-ink-400 dark:text-ink-500">{formatDateTime(version.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <p className="text-xs text-ink-500 dark:text-ink-400">
        <Link href="/admin/questions" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Back to the question bank
        </Link>
      </p>
    </div>
  );
}
