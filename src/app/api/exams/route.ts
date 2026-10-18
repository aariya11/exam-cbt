import { prisma } from "@/lib/db";
import { handle, ok, parsePagination } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api";
import { EXAM_STATUS } from "@/lib/constants";
import { getExamParticipationStats } from "@/lib/leaderboard";

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  enforceRateLimit(`exams-list:${getClientIp(req) ?? "unknown"}`, 240, 60 * 1000);
  const { page, pageSize } = parsePagination(url, 24);

  const categoryId = url.searchParams.get("categoryId");
  const difficulty = url.searchParams.get("difficulty");
  const search = url.searchParams.get("search");

  const where = {
    status: EXAM_STATUS.ACTIVE,
    ...(categoryId ? { categoryId } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        category: true,
        sections: { orderBy: { sortOrder: "asc" }, include: { subject: true } },
        _count: { select: { questions: true } },
      },
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const stats = await getExamParticipationStats(exams.map((e) => e.id));

  return ok({
    total,
    page,
    pageSize,
    exams: exams.map((exam) => ({
      id: exam.id,
      slug: exam.slug,
      title: exam.title,
      description: exam.description,
      difficulty: exam.difficulty,
      durationMinutes: exam.durationMinutes,
      marksPerCorrect: exam.marksPerCorrect,
      negativeMarksPerWrong: exam.negativeMarksPerWrong,
      category: { id: exam.category.id, slug: exam.category.slug, name: exam.category.name },
      sections: exam.sections.map((section) => ({
        id: section.id,
        title: section.title,
        subject: section.subject.name,
        questionCount: section.questionCount,
      })),
      questionCount: exam._count.questions,
      participants: stats.get(exam.id)?.participants ?? 0,
      averagePercentage: stats.get(exam.id)?.averagePercentage ?? null,
      opensAt: exam.opensAt?.toISOString() ?? null,
      closesAt: exam.closesAt?.toISOString() ?? null,
      requiresDesktop: exam.requiresDesktop,
    })),
  });
});
