import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { examUpdateSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.EXAM_MANAGER);
  const { id } = await ctx.params;

  const existing = await prisma.exam.findUnique({ where: { id }, include: { sections: true } });
  if (!existing) throw notFound("Examination not found.");

  const input = await readJson(req, examUpdateSchema);
  const before = {
    title: existing.title,
    status: existing.status,
    durationMinutes: existing.durationMinutes,
    marksPerCorrect: existing.marksPerCorrect,
    negativeMarksPerWrong: existing.negativeMarksPerWrong,
    tieBreakRules: existing.tieBreakRules,
  };

  const exam = await prisma.$transaction(async (tx) => {
    if (input.sections) {
      // Replace sections. Existing section rows are deleted only when no
      // questions are linked to them; otherwise the update is rejected to
      // protect attempt papers and results.
      const linked = await tx.examQuestion.count({ where: { examId: id, sectionId: { not: null } } });
      if (linked > 0) {
        const current = new Set(existing.sections.map((s) => `${s.subjectId}|${s.title}|${s.questionCount}`));
        const next = new Set(input.sections.map((s) => `${s.subjectId}|${s.title}|${s.questionCount}`));
        const unchanged = current.size === next.size && [...current].every((key) => next.has(key));
        if (!unchanged) {
          throw new (await import("@/lib/errors")).AppError(
            409,
            "SECTIONS_LOCKED",
            "This examination already has questions assigned. Create a new examination version instead of changing sections.",
          );
        }
      } else {
        await tx.examSection.deleteMany({ where: { examId: id } });
        await tx.examSection.createMany({
          data: input.sections.map((section, index) => ({
            examId: id,
            subjectId: section.subjectId,
            title: section.title,
            questionCount: section.questionCount,
            marksPerCorrect: section.marksPerCorrect ?? null,
            negativeMarksPerWrong: section.negativeMarksPerWrong ?? null,
            sortOrder: index,
          })),
        });
      }
    }

    return tx.exam.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.marksPerCorrect !== undefined ? { marksPerCorrect: input.marksPerCorrect } : {}),
        ...(input.negativeMarksPerWrong !== undefined ? { negativeMarksPerWrong: input.negativeMarksPerWrong } : {}),
        ...(input.allowPartialCredit !== undefined ? { allowPartialCredit: input.allowPartialCredit } : {}),
        ...(input.shuffleQuestions !== undefined ? { shuffleQuestions: input.shuffleQuestions } : {}),
        ...(input.shuffleOptions !== undefined ? { shuffleOptions: input.shuffleOptions } : {}),
        ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.opensAt !== undefined ? { opensAt: input.opensAt ? new Date(input.opensAt) : null } : {}),
        ...(input.closesAt !== undefined ? { closesAt: input.closesAt ? new Date(input.closesAt) : null } : {}),
        ...(input.publishResultsImmediately !== undefined ? { publishResultsImmediately: input.publishResultsImmediately } : {}),
        ...(input.resultsPublishAt !== undefined ? { resultsPublishAt: input.resultsPublishAt ? new Date(input.resultsPublishAt) : null } : {}),
        ...(input.revealSolutions !== undefined ? { revealSolutions: input.revealSolutions } : {}),
        ...(input.requiresDesktop !== undefined ? { requiresDesktop: input.requiresDesktop } : {}),
        ...(input.maxFocusWarnings !== undefined ? { maxFocusWarnings: input.maxFocusWarnings } : {}),
        ...(input.tieBreakRules !== undefined ? { tieBreakRules: JSON.stringify(input.tieBreakRules) } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions ?? null } : {}),
      },
    });
  });

  await writeAudit({
    actorId: auth.user.id,
    action: "exam.updated",
    entityType: "Exam",
    entityId: id,
    before,
    after: {
      title: exam.title,
      status: exam.status,
      durationMinutes: exam.durationMinutes,
      marksPerCorrect: exam.marksPerCorrect,
      negativeMarksPerWrong: exam.negativeMarksPerWrong,
      tieBreakRules: exam.tieBreakRules,
    },
  });

  return ok({ id: exam.id, slug: exam.slug, status: exam.status });
});
