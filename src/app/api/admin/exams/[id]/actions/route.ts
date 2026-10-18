import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, handle, ok, readJson, requireRole } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["ACTIVATE", "ARCHIVE", "PUBLISH_RESULTS", "UNPUBLISH_RESULTS"]),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const auth = await requireRole(req, ROLES.EXAM_MANAGER);
  const { id } = await ctx.params;
  const { action } = await readJson(req, schema);

  const exam = await prisma.exam.findUnique({ where: { id }, include: { _count: { select: { questions: true } } } });
  if (!exam) throw notFound("Examination not found.");

  const before = { status: exam.status, publishResultsImmediately: exam.publishResultsImmediately };

  if (action === "ACTIVATE") {
    if (exam._count.questions === 0) {
      const { unprocessable } = await import("@/lib/errors");
      throw unprocessable("Assign questions before activating this examination.", "NO_QUESTIONS");
    }
    await prisma.exam.update({ where: { id }, data: { status: "ACTIVE" } });
  } else if (action === "ARCHIVE") {
    await prisma.exam.update({ where: { id }, data: { status: "ARCHIVED" } });
  } else if (action === "PUBLISH_RESULTS") {
    const now = new Date();
    await prisma.$transaction([
      prisma.result.updateMany({
        where: { examId: id, publishedAt: null },
        data: { publishedAt: now },
      }),
      prisma.exam.update({
        where: { id },
        data: { publishResultsImmediately: true, resultsPublishAt: now },
      }),
    ]);
    // Recompute published ranks in one consistent pass.
    const published = await prisma.result.findMany({
      where: { examId: id, publishedAt: { not: null } },
      orderBy: { score: "desc" },
    });
    let rank = 0;
    let previous: number | null = null;
    for (let i = 0; i < published.length; i++) {
      if (previous === null || published[i].score !== previous) {
        rank = i + 1;
        previous = published[i].score;
      }
      if (published[i].rankSnapshot !== rank) {
        await prisma.result.update({ where: { id: published[i].id }, data: { rankSnapshot: rank } });
      }
    }
    const notified = await prisma.attempt.findMany({
      where: { examId: id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      select: { id: true, userId: true },
    });
    for (const attempt of notified) {
      await prisma.notification.create({
        data: {
          userId: attempt.userId,
          type: "result",
          title: `Results published: ${exam.title}`,
          body: "Your result for this mock test is now available.",
          link: `/attempt/${attempt.id}/result`,
        },
      });
    }
  } else {
    await prisma.$transaction([
      prisma.result.updateMany({ where: { examId: id }, data: { publishedAt: null, rankSnapshot: null } }),
      prisma.exam.update({
        where: { id },
        data: { publishResultsImmediately: false, resultsPublishAt: null },
      }),
    ]);
  }

  await writeAudit({
    actorId: auth.user.id,
    action: `exam.${action.toLowerCase()}`,
    entityType: "Exam",
    entityId: id,
    before,
    after: { action },
  });

  return ok({ action, examId: id });
});
