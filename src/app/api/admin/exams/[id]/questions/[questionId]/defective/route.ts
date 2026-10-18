import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { questionDefectiveSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { regradeExam } from "@/lib/regrade";

// Declaring a question defective excludes it from scoring across the whole
// examination and regrades every affected result with a full audit trail.
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; questionId: string }> }) => {
    assertSameOrigin(req);
    const auth = await requireRole(req, ROLES.ADMIN);
    const { id: examId, questionId } = await ctx.params;
    const input = await readJson(req, questionDefectiveSchema);

    const link = await prisma.examQuestion.findUnique({
      where: { examId_questionId: { examId, questionId } },
    });
    if (!link) throw notFound("This question is not part of the examination.");

    await prisma.examQuestion.update({
      where: { id: link.id },
      data: { isDefective: input.defective },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: input.defective ? "exam.question_marked_defective" : "exam.question_restored",
      entityType: "Exam",
      entityId: examId,
      before: { isDefective: link.isDefective },
      after: { isDefective: input.defective, reason: input.reason, questionId },
    });

    const regrade = await regradeExam(examId, auth.user.id, input.reason);
    return ok({ defective: input.defective, ...regrade });
  },
);
