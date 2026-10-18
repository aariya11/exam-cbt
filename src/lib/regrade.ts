import { prisma } from "./db";
import { parsePaper } from "./paper";
import { scoreAttempt, type ScoringQuestion } from "./scoring";
import { writeAudit } from "./audit";
import { notFound } from "./errors";

// Controlled regrading.
//
// When a question is declared defective, every attempt of that examination is
// re-scored excluding defective questions, subject scores are rewritten, and
// published ranks are recomputed consistently. Every step is audited with
// before/after values so a dispute can be reconstructed exactly.

export async function regradeExam(
  examId: string,
  actorId: string,
  reason: string,
): Promise<{ regraded: number; excludedQuestions: number }> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw notFound("Examination not found.");

  const defective = await prisma.examQuestion.findMany({
    where: { examId, isDefective: true },
    select: { questionId: true },
  });
  const excluded = new Set(defective.map((row) => row.questionId));

  const attempts = await prisma.attempt.findMany({
    where: { examId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    include: { result: true },
  });

  const questionRows = await prisma.question.findMany({
    where: { exams: { some: { examId } } },
    include: { options: true, subject: true, topic: true },
  });
  const questionById = new Map(questionRows.map((q) => [q.id, q]));

  let regraded = 0;
  for (const attempt of attempts) {
    if (!attempt.result) continue;
    const paper = parsePaper(attempt.paperJson);
    const answers = await prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } });

    const scoringQuestions: ScoringQuestion[] = paper.questions
      .filter((pq) => !excluded.has(pq.questionId))
      .flatMap((pq) => {
        const question = questionById.get(pq.questionId);
        if (!question) return [];
        return [
          {
            questionId: question.id,
            type: question.type,
            subjectId: question.subject.id,
            subjectName: question.subject.name,
            topicId: question.topic?.id ?? null,
            topicName: question.topic?.name ?? null,
            difficulty: question.difficulty,
            marks: pq.marks,
            negativeMarks: pq.negativeMarks,
            optionIds: pq.optionOrder,
            correctOptionIds: question.options.filter((o) => o.isCorrect).map((o) => o.id),
          },
        ];
      });

    const scored = scoreAttempt(
      scoringQuestions,
      answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: JSON.parse(a.selectedOptionIds) as string[],
      })),
      { allowPartialCredit: exam.allowPartialCredit },
    );

    const before = {
      score: attempt.result.score,
      maxScore: attempt.result.maxScore,
      percentage: attempt.result.percentage,
      rankSnapshot: attempt.result.rankSnapshot,
    };

    await prisma.$transaction(async (tx) => {
      await tx.result.update({
        where: { id: attempt.result!.id },
        data: {
          score: scored.score,
          maxScore: scored.maxScore,
          percentage: scored.percentage,
          correctCount: scored.correctCount,
          wrongCount: scored.wrongCount,
          unansweredCount: scored.unansweredCount,
          accuracy: scored.accuracy,
          subjectBreakdown: JSON.stringify(scored.subjectBreakdown),
          topicBreakdown: JSON.stringify(scored.topicBreakdown),
          regradedAt: new Date(),
        },
      });
      await tx.resultSubjectScore.deleteMany({ where: { resultId: attempt.result!.id } });
      await tx.resultSubjectScore.createMany({
        data: scored.subjectBreakdown.map((s) => ({
          resultId: attempt.result!.id,
          subjectId: s.subjectId,
          score: s.score,
          maxScore: s.maxScore,
          correct: s.correct,
          wrong: s.wrong,
          unanswered: s.unanswered,
        })),
      });
      await writeAudit(
        {
          actorId,
          action: "result.regraded",
          entityType: "Result",
          entityId: attempt.result!.id,
          before,
          after: { score: scored.score, maxScore: scored.maxScore, percentage: scored.percentage },
        },
        tx as unknown as Parameters<typeof writeAudit>[1],
      );
    });
    regraded += 1;
  }

  // Recompute rank snapshots for every published result of this exam so the
  // stored ranks match the corrected scores (competition ranking).
  const published = await prisma.result.findMany({
    where: { examId, publishedAt: { not: null } },
    orderBy: { score: "desc" },
  });
  let rank = 0;
  let previousScore: number | null = null;
  let index = 0;
  for (const result of published) {
    index += 1;
    if (previousScore === null || result.score !== previousScore) {
      rank = index;
      previousScore = result.score;
    }
    if (result.rankSnapshot !== rank) {
      await prisma.result.update({ where: { id: result.id }, data: { rankSnapshot: rank } });
    }
  }

  await writeAudit({
    actorId,
    action: "exam.regraded",
    entityType: "Exam",
    entityId: examId,
    after: { regraded, excludedQuestions: excluded.size, reason },
  });

  return { regraded, excludedQuestions: excluded.size };
}
