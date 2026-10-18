import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { notFound, unprocessable } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["ASSIGN", "UNASSIGN"]),
  sectionId: z.string().min(1),
  questionIds: z.array(z.string().min(1)).min(1).max(500),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.EXAM_MANAGER);
  const { id: examId } = await ctx.params;

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw notFound("Examination not found.");

  const input = await readJson(req, schema);
  const section = await prisma.examSection.findUnique({ where: { id: input.sectionId } });
  if (!section || section.examId !== examId) throw notFound("Section not found on this examination.");

  if (input.action === "ASSIGN") {
    const questions = await prisma.question.findMany({
      where: { id: { in: input.questionIds } },
      include: { _count: { select: { options: true } } },
    });
    if (questions.length !== input.questionIds.length) throw notFound("One or more questions were not found.");
    const notPublished = questions.filter((q) => q.status !== "PUBLISHED");
    if (notPublished.length > 0) {
      throw unprocessable(
        "Only published questions can be assigned to an examination.",
        "NOT_PUBLISHED",
        { questionIds: notPublished.map((q) => q.id) },
      );
    }
    const subjectMismatch = questions.filter((q) => q.subjectId !== section.subjectId);
    if (subjectMismatch.length > 0) {
      throw unprocessable(
        "All questions in a section must belong to the section's subject.",
        "SUBJECT_MISMATCH",
        { questionIds: subjectMismatch.map((q) => q.id) },
      );
    }

    let assigned = 0;
    for (const questionId of input.questionIds) {
      const existing = await prisma.examQuestion.findUnique({
        where: { examId_questionId: { examId, questionId } },
      });
      if (existing) {
        if (existing.sectionId !== input.sectionId) {
          await prisma.examQuestion.update({ where: { id: existing.id }, data: { sectionId: input.sectionId } });
          assigned += 1;
        }
        continue;
      }
      await prisma.examQuestion.create({
        data: { examId, questionId, sectionId: input.sectionId, orderIndex: 0 },
      });
      assigned += 1;
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "exam.questions_assigned",
      entityType: "Exam",
      entityId: examId,
      after: { sectionId: input.sectionId, assigned },
    });
    return ok({ assigned });
  }

  // UNASSIGN - blocked once attempts exist, so no paper becomes unscoreable.
  const attemptCount = await prisma.attempt.count({ where: { examId } });
  if (attemptCount > 0) {
    throw unprocessable(
      "Questions cannot be removed after attempts exist. Create a new examination version instead.",
      "ATTEMPTS_EXIST",
    );
  }
  const removed = await prisma.examQuestion.deleteMany({
    where: { examId, questionId: { in: input.questionIds } },
  });
  await writeAudit({
    actorId: auth.user.id,
    action: "exam.questions_unassigned",
    entityType: "Exam",
    entityId: examId,
    after: { removed: removed.count },
  });
  return ok({ removed: removed.count });
});

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole(req, ROLES.EXAM_MANAGER);
  const { id: examId } = await ctx.params;
  const rows = await prisma.examQuestion.findMany({
    where: { examId },
    include: { question: { include: { subject: true } }, section: true },
    orderBy: { orderIndex: "asc" },
  });
  return ok({
    questions: rows.map((row) => ({
      questionId: row.questionId,
      text: row.question.text,
      subject: row.question.subject.name,
      difficulty: row.question.difficulty,
      status: row.question.status,
      sectionId: row.sectionId,
      sectionTitle: row.section?.title ?? null,
      isDefective: row.isDefective,
    })),
  });
});
