import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { questionSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.QUESTION_EDITOR);
  const { id } = await ctx.params;

  const existing = await prisma.question.findUnique({ where: { id }, include: { options: true } });
  if (!existing) throw notFound("Question not found.");

  // Published questions are content-locked: editing them would silently change
  // what past candidates were graded against. Create a new version instead.
  if (existing.status === "PUBLISHED") {
    throw conflict(
      "Published questions are immutable. Duplicate this question into a new version instead.",
      "QUESTION_LOCKED",
    );
  }

  const input = await readJson(req, questionSchema);

  const updated = await prisma.$transaction(async (tx) => {
    // Immutable version snapshot of the previous state, for audit.
    await tx.questionVersion.create({
      data: {
        questionId: id,
        version: existing.version,
        snapshot: JSON.stringify({
          text: existing.text,
          difficulty: existing.difficulty,
          type: existing.type,
          explanation: existing.explanation,
          options: existing.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: o.sortOrder })),
        }),
        editedById: auth.user.id,
      },
    });

    await tx.questionOption.deleteMany({ where: { questionId: id } });

    return tx.question.update({
      where: { id },
      data: {
        subjectId: input.subjectId,
        topicId: input.topicId ?? null,
        difficulty: input.difficulty,
        type: input.type,
        text: input.text,
        explanation: input.explanation ?? null,
        imageUrl: input.imageUrl || null,
        source: input.source ?? null,
        license: input.license ?? null,
        version: existing.version + 1,
        status: existing.status === "RETIRED" ? "RETIRED" : "DRAFT",
        options: {
          create: input.options.map((option, index) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            sortOrder: index,
          })),
        },
      },
    });
  });

  await writeAudit({
    actorId: auth.user.id,
    action: "question.updated",
    entityType: "Question",
    entityId: id,
    before: { version: existing.version, status: existing.status },
    after: { version: updated.version, status: updated.status },
  });

  return ok({ id: updated.id, version: updated.version, status: updated.status });
});
