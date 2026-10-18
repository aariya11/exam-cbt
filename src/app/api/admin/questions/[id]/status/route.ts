import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { questionStatusSchema } from "@/lib/validation";
import { ROLES, isAtLeastRole } from "@/lib/constants";
import { notFound, unprocessable } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

// Review workflow: DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> RETIRED.
// Publishing requires an administrator; editors can move questions through
// review stages. Provenance (source and licence) is mandatory before publish.
const ALLOWED: Record<string, string[]> = {
  DRAFT: ["IN_REVIEW", "RETIRED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "RETIRED"],
  APPROVED: ["PUBLISHED", "IN_REVIEW", "RETIRED"],
  PUBLISHED: ["RETIRED"],
  RETIRED: [],
};

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.QUESTION_EDITOR);
  const { id } = await ctx.params;
  const { status } = await readJson(req, questionStatusSchema);

  const question = await prisma.question.findUnique({
    where: { id },
    include: { _count: { select: { options: true } } },
  });
  if (!question) throw notFound("Question not found.");

  const allowed = ALLOWED[question.status] ?? [];
  if (!allowed.includes(status)) {
    throw unprocessable(`Cannot move a question from ${question.status} to ${status}.`, "INVALID_TRANSITION");
  }

  if (status === "PUBLISHED") {
    if (!isAtLeastRole(auth.user.role, ROLES.ADMIN)) {
      throw unprocessable("Only an administrator can publish questions.", "ROLE_REQUIRED");
    }
    if (!question.source || !question.license) {
      throw unprocessable(
        "Questions require provenance (source and licence) before publication.",
        "PROVENANCE_REQUIRED",
      );
    }
    if (question._count.options < 2) {
      throw unprocessable("A question needs at least two options.", "OPTIONS_REQUIRED");
    }
  }

  await prisma.question.update({
    where: { id },
    data: {
      status,
      ...(status === "APPROVED" ? {} : {}),
      ...(status === "PUBLISHED" || status === "APPROVED"
        ? { reviewedById: auth.user.id, reviewedAt: new Date() }
        : {}),
    },
  });

  await writeAudit({
    actorId: auth.user.id,
    action: "question.status_changed",
    entityType: "Question",
    entityId: id,
    before: { status: question.status },
    after: { status },
  });

  return ok({ id, status });
});
