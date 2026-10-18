import { prisma } from "@/lib/db";
import { assertSameOrigin, created, handle, ok, parsePagination, readJson, requireRole } from "@/lib/api";
import { questionSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { unprocessable } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.QUESTION_EDITOR);
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url, 25);
  const subjectId = url.searchParams.get("subjectId");
  const difficulty = url.searchParams.get("difficulty");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  const where = {
    ...(subjectId ? { subjectId } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(status ? { status } : {}),
    ...(search ? { text: { contains: search } } : {}),
  };

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: {
        subject: true,
        topic: true,
        options: { orderBy: { sortOrder: "asc" } },
        createdBy: { select: { username: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    questions: questions.map((question) => ({
      id: question.id,
      text: question.text,
      status: question.status,
      difficulty: question.difficulty,
      type: question.type,
      subject: question.subject.name,
      topic: question.topic?.name ?? null,
      version: question.version,
      options: question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      source: question.source,
      license: question.license,
      author: question.createdBy.username,
      updatedAt: question.updatedAt.toISOString(),
    })),
  });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = await requireRole(req, ROLES.QUESTION_EDITOR);
  enforceRateLimit(`question-create:${ctx.user.id}`, 120, 60 * 1000);

  const input = await readJson(req, questionSchema);

  // Duplicate detection within the same subject (normalised text compare).
  const normalized = input.text.trim().toLowerCase();
  const duplicates = await prisma.question.findMany({
    where: { subjectId: input.subjectId, status: { not: "RETIRED" } },
    select: { id: true, text: true },
  });
  const duplicate = duplicates.find((q) => q.text.trim().toLowerCase() === normalized);
  if (duplicate) {
    throw unprocessable(
      "An identical question already exists in this subject.",
      "DUPLICATE_QUESTION",
      { existingQuestionId: duplicate.id },
    );
  }

  const question = await prisma.question.create({
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
      status: "DRAFT",
      createdById: ctx.user.id,
      options: {
        create: input.options.map((option, index) => ({
          text: option.text,
          isCorrect: option.isCorrect,
          sortOrder: index,
        })),
      },
    },
  });

  await writeAudit({
    actorId: ctx.user.id,
    action: "question.created",
    entityType: "Question",
    entityId: question.id,
    after: { subjectId: input.subjectId, difficulty: input.difficulty, status: "DRAFT" },
  });

  return created({ id: question.id });
});
