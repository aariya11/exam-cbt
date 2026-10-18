import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES, type TieBreakRule } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { Badge, Card, CardHeader, Stat, statusTone } from "@/components/ui";
import { ExamForm } from "@/components/admin/exam-form";
import { ExamLifecycle } from "@/components/admin/exam-lifecycle";
import { ExamQuestionManager } from "@/components/admin/exam-question-manager";

export const dynamic = "force-dynamic";

export default async function AdminExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      category: true,
      sections: { include: { subject: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { attempts: true, questions: true } },
    },
  });
  if (!exam) notFound();

  const [categories, subjects, assigned, linkedCount, openAlertCount] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ include: { topics: true }, orderBy: { name: "asc" } }),
    prisma.examQuestion.findMany({
      where: { examId: id },
      include: { question: { include: { subject: true } }, section: true },
      orderBy: { orderIndex: "asc" },
      take: 300,
    }),
    prisma.examQuestion.count({ where: { examId: id, sectionId: { not: null } } }),
    prisma.integrityAlert.count({ where: { attempt: { examId: id }, status: "OPEN" } }),
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

  let tieBreakRules: string[] = [];
  try {
    const parsed = JSON.parse(exam.tieBreakRules) as unknown;
    if (Array.isArray(parsed)) tieBreakRules = parsed.filter((rule): rule is string => typeof rule === "string");
  } catch {
    tieBreakRules = [];
  }

  const isAdmin = isAtLeastRole(user.role, ROLES.ADMIN);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">{exam.title}</h1>
            <Badge tone={statusTone(exam.status)}>{exam.status.toLowerCase()}</Badge>
            {openAlertCount > 0 ? <Badge tone="danger">{formatNumber(openAlertCount)} open alert(s)</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            /{exam.slug} · {exam.category.name}
          </p>
        </div>
        <ExamLifecycle examId={exam.id} status={exam.status} questionsAssigned={exam._count.questions} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Question pool" value={formatNumber(exam._count.questions)} hint={`${formatNumber(linkedCount)} linked to sections`} />
        <Stat label="Attempts" value={formatNumber(exam._count.attempts)} hint="All statuses" />
        <Stat label="Duration" value={`${exam.durationMinutes} min`} hint={`${exam.marksPerCorrect} marks correct · -${exam.negativeMarksPerWrong} wrong`} />
        <Stat label="Sections" value={formatNumber(exam.sections.length)} hint={exam.sections.map((s) => s.subject.name).join(", ")} />
      </div>

      <ExamQuestionManager
        examId={exam.id}
        attemptsExist={exam._count.attempts > 0}
        canMarkDefective={isAdmin}
        meta={meta}
        sections={exam.sections.map((section) => ({
          id: section.id,
          title: section.title,
          subjectId: section.subjectId,
          subjectName: section.subject.name,
          questionCount: section.questionCount,
        }))}
        assigned={assigned.map((row) => ({
          questionId: row.questionId,
          text: row.question.text,
          subject: row.question.subject.name,
          difficulty: row.question.difficulty,
          sectionId: row.sectionId,
          sectionTitle: row.section?.title ?? null,
          isDefective: row.isDefective,
        }))}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-ink-950 dark:text-ink-50">Examination settings</h2>
        <ExamForm
          mode="edit"
          examId={exam.id}
          meta={meta}
          sectionsLocked={linkedCount > 0}
          initial={{
            title: exam.title,
            slug: exam.slug,
            description: exam.description,
            categoryId: exam.categoryId,
            difficulty: exam.difficulty,
            durationMinutes: exam.durationMinutes,
            marksPerCorrect: exam.marksPerCorrect,
            negativeMarksPerWrong: exam.negativeMarksPerWrong,
            allowPartialCredit: exam.allowPartialCredit,
            shuffleQuestions: exam.shuffleQuestions,
            shuffleOptions: exam.shuffleOptions,
            maxAttempts: exam.maxAttempts,
            status: exam.status,
            opensAt: exam.opensAt?.toISOString() ?? null,
            closesAt: exam.closesAt?.toISOString() ?? null,
            publishResultsImmediately: exam.publishResultsImmediately,
            revealSolutions: exam.revealSolutions,
            requiresDesktop: exam.requiresDesktop,
            maxFocusWarnings: exam.maxFocusWarnings,
            tieBreakRules,
            instructions: exam.instructions,
            sections: exam.sections.map((section) => ({
              subjectId: section.subjectId,
              title: section.title,
              questionCount: section.questionCount,
            })),
          }}
        />
      </div>

      <Card>
        <CardHeader
          title="Tie-break rules in force"
          description="Applied in order after total score when ranks are computed"
        />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {tieBreakRules.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No tie-break rules — tied candidates share the same rank.</p>
          ) : (
            tieBreakRules.map((rule: TieBreakRule | string, index) => (
              <Badge key={rule} tone="brand">
                {index + 1}. {String(rule).replaceAll("_", " ").toLowerCase()}
              </Badge>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
