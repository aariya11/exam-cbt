import { prisma, isUniqueConstraintError } from "@/lib/db";
import { assertSameOrigin, created, handle, ok, parsePagination, readJson, requireRole } from "@/lib/api";
import { examSchema } from "@/lib/validation";
import { ROLES } from "@/lib/constants";
import { conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = handle(async (req: Request) => {
  await requireRole(req, ROLES.EXAM_MANAGER);
  const url = new URL(req.url);
  const { page, pageSize } = parsePagination(url, 20);
  const status = url.searchParams.get("status");

  const where = status ? { status } : {};
  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        category: true,
        sections: { include: { subject: true } },
        _count: { select: { attempts: true, questions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    exams: exams.map((exam) => ({
      id: exam.id,
      slug: exam.slug,
      title: exam.title,
      status: exam.status,
      difficulty: exam.difficulty,
      category: exam.category.name,
      durationMinutes: exam.durationMinutes,
      sections: exam.sections.map((s) => ({ id: s.id, title: s.title, subject: s.subject.name, questionCount: s.questionCount })),
      questionPool: exam._count.questions,
      attempts: exam._count.attempts,
      opensAt: exam.opensAt?.toISOString() ?? null,
      closesAt: exam.closesAt?.toISOString() ?? null,
    })),
  });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = await requireRole(req, ROLES.EXAM_MANAGER);
  enforceRateLimit(`admin-exam-create:${ctx.user.id}`, 30, 60 * 1000);

  const input = await readJson(req, examSchema);

  try {
    const exam = await prisma.exam.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        difficulty: input.difficulty,
        durationMinutes: input.durationMinutes,
        marksPerCorrect: input.marksPerCorrect,
        negativeMarksPerWrong: input.negativeMarksPerWrong,
        allowPartialCredit: input.allowPartialCredit,
        shuffleQuestions: input.shuffleQuestions,
        shuffleOptions: input.shuffleOptions,
        maxAttempts: input.maxAttempts ?? null,
        status: input.status,
        opensAt: input.opensAt ? new Date(input.opensAt) : null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        publishResultsImmediately: input.publishResultsImmediately,
        resultsPublishAt: input.resultsPublishAt ? new Date(input.resultsPublishAt) : null,
        revealSolutions: input.revealSolutions,
        requiresDesktop: input.requiresDesktop,
        maxFocusWarnings: input.maxFocusWarnings,
        tieBreakRules: JSON.stringify(input.tieBreakRules),
        instructions: input.instructions ?? null,
        createdById: ctx.user.id,
        sections: {
          create: input.sections.map((section, index) => ({
            subjectId: section.subjectId,
            title: section.title,
            questionCount: section.questionCount,
            marksPerCorrect: section.marksPerCorrect ?? null,
            negativeMarksPerWrong: section.negativeMarksPerWrong ?? null,
            sortOrder: index,
          })),
        },
      },
      include: { sections: true },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "exam.created",
      entityType: "Exam",
      entityId: exam.id,
      after: { slug: exam.slug, title: exam.title, status: exam.status },
    });

    return created({ id: exam.id, slug: exam.slug, sections: exam.sections.length });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("An examination with this slug already exists.", "SLUG_TAKEN");
    }
    throw error;
  }
});
