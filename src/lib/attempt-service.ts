import { createHmac } from "crypto";
import type { Attempt, Exam, Question, QuestionOption } from "@prisma/client";
import { prisma } from "./db";
import { AppError, conflict, forbidden, notFound, unprocessable } from "./errors";
import { buildPaper, parsePaper, resolveMarks, type Paper } from "./paper";
import { scoreAttempt, type ScoringQuestion } from "./scoring";
import { randomHex } from "./rng";
import { ATTEMPT_EVENTS, INTEGRITY_ALERT_TYPES, EXAM_STATUS } from "./constants";
import { writeAudit } from "./audit";
import { evaluateAchievementCodes } from "./achievements";

// ------------------------------------------------------------------
// Examination lifecycle service.
//
// Timing authority: the server clock. `startedAt` and `deadlineAt` are
// computed here and stored; clients only render the countdown. Every write
// path re-checks the deadline against server time, and finalisation claims the
// attempt with a conditional update so double submission can never create two
// results.
// ------------------------------------------------------------------

const graceMs = () => (Number(process.env.DEADLINE_GRACE_SECONDS ?? "2") || 0) * 1000;

export type StartAttemptContext = {
  userId: string;
  sessionId: string;
  ip: string | null;
  userAgent: string | null;
};

export async function startOrResumeAttempt(
  exam: Exam & { sections: { id: string; title: string; questionCount: number; marksPerCorrect: number | null; negativeMarksPerWrong: number | null; sortOrder: number; subjectId: string }[] },
  ctx: StartAttemptContext,
): Promise<{ attempt: Attempt; resumed: boolean }> {
  const now = new Date();

  if (exam.status !== EXAM_STATUS.ACTIVE) {
    throw forbidden("This examination is not currently open.");
  }
  if (exam.opensAt && now < exam.opensAt) {
    throw forbidden("This examination has not opened yet.");
  }
  if (exam.closesAt && now > exam.closesAt) {
    throw forbidden("The availability window for this examination has closed.");
  }

  const existing = await prisma.attempt.findFirst({
    where: { userId: ctx.userId, examId: exam.id, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });

  if (existing) {
    if (now.getTime() > existing.deadlineAt.getTime() + graceMs()) {
      // The stored attempt is already past its deadline: finalise it and treat
      // this request as a fresh start (attempt limits permitting).
      await finalizeAttempt(existing.id, "deadline_exceeded");
    } else {
      return { attempt: existing, resumed: true };
    }
  }

  if (exam.maxAttempts !== null) {
    const used = await prisma.attempt.count({
      where: { userId: ctx.userId, examId: exam.id, status: { not: "INVALIDATED" } },
    });
    if (used >= exam.maxAttempts) {
      throw conflict("You have used all allowed attempts for this examination.", "ATTEMPT_LIMIT_REACHED");
    }
  }

  const seed = randomHex(16);
  const sections = [...exam.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sections.length === 0) throw unprocessable("This examination has no sections configured.", "NO_SECTIONS");

  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId: exam.id, isDefective: false, question: { status: "PUBLISHED" } },
    include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
  });

  const pool = examQuestions.map((eq) => {
    const { marks, negativeMarks } = resolveMarks(exam, null, eq);
    return {
      questionId: eq.questionId,
      sectionId: eq.sectionId,
      subjectId: eq.question.subjectId,
      difficulty: eq.question.difficulty,
      optionIds: eq.question.options.map((o) => o.id),
      marks,
      negativeMarks,
    };
  });

  const paper = buildPaper({
    seed,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      questionCount: section.questionCount,
      marksPerCorrect: section.marksPerCorrect ?? exam.marksPerCorrect,
      negativeMarksPerWrong: section.negativeMarksPerWrong ?? exam.negativeMarksPerWrong,
    })),
    pool,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
  });

  const durationMs = exam.durationMinutes * 60_000;
  let deadline = new Date(now.getTime() + durationMs);
  if (exam.closesAt && deadline > exam.closesAt) deadline = exam.closesAt;

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        userId: ctx.userId,
        examId: exam.id,
        status: "IN_PROGRESS",
        startedAt: now,
        deadlineAt: deadline,
        paperJson: JSON.stringify(paper),
        seed,
        sessionId: ctx.sessionId,
        ipHash: ctx.ip ? hashIp(ctx.ip) : null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      },
    });
    await tx.attemptEvent.create({
      data: {
        attemptId: attempt.id,
        type: ATTEMPT_EVENTS.START,
        detail: JSON.stringify({ examId: exam.id, deadline: deadline.toISOString(), questionCount: paper.questions.length }),
        ip: ctx.ip,
      },
    });
    return { attempt, resumed: false };
  });
}

function hashIp(ip: string): string {
  return createHmac("sha256", process.env.SESSION_PEPPER ?? "rankforge")
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

export type AttemptAccess = {
  attempt: Attempt;
  exam: Exam;
};

// Load an attempt for a student request, enforcing ownership and the
// one-active-session rule, and lazily finalising attempts whose deadline has
// passed.
export async function loadAttemptForStudent(
  attemptId: string,
  userId: string,
  sessionId: string,
  opts: { forWrite: boolean; ip?: string | null },
): Promise<AttemptAccess> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt) throw notFound("Examination attempt not found.");
  if (attempt.userId !== userId) throw forbidden();

  if (attempt.status === "IN_PROGRESS") {
    if (Date.now() > attempt.deadlineAt.getTime() + graceMs()) {
      await finalizeAttempt(attempt.id, "deadline_exceeded");
      const finalized = await prisma.attempt.findUniqueOrThrow({
        where: { id: attempt.id },
        include: { exam: true },
      });
      if (opts.forWrite) {
        throw conflict("The examination deadline has passed. Your attempt was submitted.", "ATTEMPT_EXPIRED");
      }
      return { attempt: finalized, exam: finalized.exam };
    }

    if (attempt.sessionId && attempt.sessionId !== sessionId) {
      // One active session per attempt. The second session is denied and the
      // event is recorded for integrity review.
      const existingAlert = await prisma.integrityAlert.findFirst({
        where: { attemptId: attempt.id, type: INTEGRITY_ALERT_TYPES.CONCURRENT_ACCESS, status: "OPEN" },
      });
      await prisma.attemptEvent.create({
        data: {
          attemptId: attempt.id,
          type: ATTEMPT_EVENTS.CONCURRENT_ACCESS,
          detail: JSON.stringify({ reason: "second session attempted access" }),
          ip: opts.ip ?? null,
        },
      });
      if (!existingAlert) {
        await prisma.integrityAlert.create({
          data: {
            attemptId: attempt.id,
            userId: attempt.userId,
            type: INTEGRITY_ALERT_TYPES.CONCURRENT_ACCESS,
            severity: "MEDIUM",
            confidence: 0.6,
            detail: JSON.stringify({
              note: "A second signed-in session attempted to open this attempt while it was in progress. This is an advisory signal, not a finding of misconduct.",
            }),
          },
        });
      }
      throw conflict(
        "This attempt is active in another session. Sign out of the other device or contact support to release the attempt.",
        "CONCURRENT_SESSION",
      );
    }

    if (!attempt.sessionId) {
      await prisma.attempt.update({
        where: { id: attempt.id },
        data: { sessionId },
      });
      attempt.sessionId = sessionId;
    }
  }

  return { attempt, exam: attempt.exam };
}

export type SaveAnswerInput = {
  questionId: string;
  selectedOptionIds: string[];
  markedForReview?: boolean;
  visited?: boolean;
};

export async function saveAnswerState(
  attempt: Attempt,
  paper: Paper,
  sessionId: string,
  input: SaveAnswerInput,
  ip: string | null,
): Promise<void> {
  if (attempt.status !== "IN_PROGRESS") {
    throw conflict("This attempt has already been submitted.", "ALREADY_FINALIZED");
  }
  if (Date.now() > attempt.deadlineAt.getTime() + graceMs()) {
    await prisma.attemptEvent.create({
      data: {
        attemptId: attempt.id,
        type: ATTEMPT_EVENTS.DEADLINE_REJECTED,
        detail: JSON.stringify({ questionId: input.questionId }),
        ip,
      },
    });
    await finalizeAttempt(attempt.id, "deadline_exceeded");
    throw conflict("The examination deadline has passed. Your attempt was submitted.", "ATTEMPT_EXPIRED");
  }

  const paperQuestion = paper.questions.find((q) => q.questionId === input.questionId);
  if (!paperQuestion) throw notFound("That question is not part of this attempt.");
  const valid = new Set(paperQuestion.optionOrder);
  const selected = input.selectedOptionIds.filter((id) => valid.has(id));

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: input.questionId } },
    update: {
      selectedOptionIds: JSON.stringify(selected),
      markedForReview: input.markedForReview ?? undefined,
      visited: input.visited ?? true,
    },
    create: {
      attemptId: attempt.id,
      questionId: input.questionId,
      selectedOptionIds: JSON.stringify(selected),
      markedForReview: input.markedForReview ?? false,
      visited: input.visited ?? true,
    },
  });
  await prisma.attemptEvent.create({
    data: {
      attemptId: attempt.id,
      type: selected.length > 0 ? ATTEMPT_EVENTS.ANSWER_SAVED : ATTEMPT_EVENTS.CLEARED,
      detail: JSON.stringify({ questionId: input.questionId, count: selected.length }),
      ip,
    },
  });
}

export async function recordAttemptEvent(
  attempt: Attempt,
  type: string,
  detail: unknown,
  ip: string | null,
  clientTime?: string | null,
): Promise<{ focusWarnings: number }> {
  await prisma.attemptEvent.create({
    data: {
      attemptId: attempt.id,
      type,
      detail: JSON.stringify(detail ?? {}),
      ip,
      clientTime: clientTime ? new Date(clientTime) : null,
    },
  });

  let focusWarnings = attempt.focusWarnings;
  if (type === ATTEMPT_EVENTS.VISIBILITY_HIDDEN || type === ATTEMPT_EVENTS.WINDOW_BLUR || type === ATTEMPT_EVENTS.FULLSCREEN_EXIT) {
    const updated = await prisma.attempt.update({
      where: { id: attempt.id },
      data: { focusWarnings: { increment: 1 } },
    });
    focusWarnings = updated.focusWarnings;
  }
  return { focusWarnings };
}

export type FinalizeOutcome = {
  alreadyFinalized: boolean;
  resultId: string;
};

// Idempotent finalisation. The attempt row is claimed with a conditional
// update inside a transaction; concurrent or repeated submission calls observe
// claim.count === 0 and return the existing result instead of creating another.
export async function finalizeAttempt(
  attemptId: string,
  reason: "student_submit" | "deadline_exceeded" | "admin",
  actor?: { id: string | null },
): Promise<FinalizeOutcome> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw notFound("Attempt not found.");

    const targetStatus = reason === "student_submit" ? "SUBMITTED" : "AUTO_SUBMITTED";
    const claim = await tx.attempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: targetStatus,
        submittedAt: now,
        finalizeReason: reason,
      },
    });

    if (claim.count === 0) {
      const existing = await tx.result.findUnique({ where: { attemptId } });
      if (!existing) {
        throw conflict("This attempt can no longer be finalised.", "ATTEMPT_NOT_FINALIZABLE");
      }
      return { alreadyFinalized: true, resultId: existing.id };
    }

    const exam = await tx.exam.findUniqueOrThrow({ where: { id: attempt.examId } });
    const paper = parsePaper(attempt.paperJson);

    const questionIds = paper.questions.map((q) => q.questionId);
    const questions = await tx.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        options: true,
        subject: true,
        topic: true,
      },
    });
    const questionById = new Map<string, Question & { options: QuestionOption[]; subject: { id: string; name: string }; topic: { id: string; name: string } | null }>(
      questions.map((q) => [q.id, q]),
    );

    const answers = await tx.attemptAnswer.findMany({ where: { attemptId } });

    const scoringQuestions: ScoringQuestion[] = paper.questions.flatMap((paperQuestion) => {
      const question = questionById.get(paperQuestion.questionId);
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
          marks: paperQuestion.marks,
          negativeMarks: paperQuestion.negativeMarks,
          optionIds: paperQuestion.optionOrder,
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

    const submittedAt = now;
    const timeUsedSec = Math.max(
      0,
      Math.min(
        exam.durationMinutes * 60,
        Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
      ),
    );

    const publishImmediately = exam.publishResultsImmediately;
    const publishedAt = publishImmediately
      ? now
      : exam.resultsPublishAt && exam.resultsPublishAt <= now
        ? exam.resultsPublishAt
        : null;

    let rankSnapshot: number | null = null;
    if (publishedAt) {
      const better = await tx.result.count({
        where: { examId: exam.id, publishedAt: { not: null }, score: { gt: scored.score } },
      });
      rankSnapshot = better + 1;
    }

    const result = await tx.result.create({
      data: {
        attemptId: attempt.id,
        examId: exam.id,
        userId: attempt.userId,
        createdAt: submittedAt,
        score: scored.score,
        maxScore: scored.maxScore,
        percentage: scored.percentage,
        correctCount: scored.correctCount,
        wrongCount: scored.wrongCount,
        unansweredCount: scored.unansweredCount,
        accuracy: scored.accuracy,
        timeUsedSec,
        subjectBreakdown: JSON.stringify(scored.subjectBreakdown),
        topicBreakdown: JSON.stringify(scored.topicBreakdown),
        publishedAt,
        rankSnapshot,
        subjectScores: {
          create: scored.subjectBreakdown.map((s) => ({
            subjectId: s.subjectId,
            score: s.score,
            maxScore: s.maxScore,
            correct: s.correct,
            wrong: s.wrong,
            unanswered: s.unanswered,
          })),
        },
      },
    });

    // Achievements - awarded from recorded performance only.
    const completedAttempts = await tx.attempt.count({
      where: { userId: attempt.userId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    });
    const codes = evaluateAchievementCodes({
      difficulty: exam.difficulty,
      result: {
        score: scored.score,
        percentage: scored.percentage,
        accuracy: scored.accuracy,
        correctCount: scored.correctCount,
        wrongCount: scored.wrongCount,
        unansweredCount: scored.unansweredCount,
        rankSnapshot,
      },
      questionCount: scoringQuestions.length,
      completedAttempts,
    });
    for (const code of codes) {
      const achievement = await tx.achievement.findUnique({ where: { code } });
      if (!achievement) continue;
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: attempt.userId, achievementId: achievement.id } },
      });
      if (!existing) {
        await tx.userAchievement.create({
          data: { userId: attempt.userId, achievementId: achievement.id, attemptId: attempt.id },
        });
      }
    }

    await tx.notification.create({
      data: {
        userId: attempt.userId,
        type: "result",
        title: publishedAt ? `Result available: ${exam.title}` : `Attempt submitted: ${exam.title}`,
        body: publishedAt
          ? `You scored ${scored.score} of ${scored.maxScore} (${scored.percentage}%).`
          : "Your answers were submitted. Results will be published according to the examination schedule.",
        link: `/attempt/${attempt.id}/result`,
      },
    });

    // Integrity heuristics - advisory signals only, always with evidence and
    // never an automatic determination of misconduct.
    const deadlineRejections = await tx.attemptEvent.count({
      where: { attemptId: attempt.id, type: ATTEMPT_EVENTS.DEADLINE_REJECTED },
    });
    if (deadlineRejections >= 5) {
      await tx.integrityAlert.create({
        data: {
          attemptId: attempt.id,
          userId: attempt.userId,
          type: INTEGRITY_ALERT_TYPES.REPEATED_DEADLINE_REJECTIONS,
          severity: "LOW",
          confidence: 0.2,
          detail: JSON.stringify({ deadlineRejections }),
        },
      });
    }
    if (attempt.focusWarnings >= exam.maxFocusWarnings) {
      await tx.integrityAlert.create({
        data: {
          attemptId: attempt.id,
          userId: attempt.userId,
          type: INTEGRITY_ALERT_TYPES.FOCUS_LOSS_THRESHOLD,
          severity: "MEDIUM",
          confidence: 0.5,
          detail: JSON.stringify({
            focusWarnings: attempt.focusWarnings,
            threshold: exam.maxFocusWarnings,
            note: "Focus-loss warnings exceeded the configured threshold. Review event timeline before drawing conclusions.",
          }),
        },
      });
    }
    if (
      scoringQuestions.length >= 20 &&
      scored.percentage >= 90 &&
      timeUsedSec < exam.durationMinutes * 60 * 0.1
    ) {
      await tx.integrityAlert.create({
        data: {
          attemptId: attempt.id,
          userId: attempt.userId,
          type: INTEGRITY_ALERT_TYPES.UNUSUAL_SUBMISSION_PATTERN,
          severity: "LOW",
          confidence: 0.3,
          detail: JSON.stringify({
            note: "Very fast high-scoring submission. Statistical signal only - not evidence of misconduct.",
            timeUsedSec,
            durationSec: exam.durationMinutes * 60,
            percentage: scored.percentage,
          }),
        },
      });
    }

    await writeAudit(
      {
        actorId: actor?.id ?? attempt.userId,
        action: "attempt.finalized",
        entityType: "Attempt",
        entityId: attempt.id,
        after: { reason, score: scored.score, maxScore: scored.maxScore, resultId: result.id },
      },
      tx as unknown as Parameters<typeof writeAudit>[1],
    );

    return { alreadyFinalized: false, resultId: result.id };
  }, { timeout: 20000 });
}

export async function finalizeExpiredAttempts(limit = 50): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: "IN_PROGRESS",
      deadlineAt: { lt: new Date(Date.now() - graceMs()) },
    },
    select: { id: true },
    take: limit,
    orderBy: { deadlineAt: "asc" },
  });

  let finalized = 0;
  for (const attempt of attempts) {
    try {
      await finalizeAttempt(attempt.id, "deadline_exceeded");
      finalized += 1;
    } catch (error) {
      console.error(`[sweeper] failed to finalize attempt ${attempt.id}`, error);
    }
  }
  return finalized;
}

export async function invalidateAttempt(
  attemptId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Attempt not found.");
  await prisma.$transaction(async (tx) => {
    await tx.attempt.update({
      where: { id: attemptId },
      data: { status: "INVALIDATED", invalidatedAt: new Date(), invalidatedReason: reason },
    });
    await writeAudit(
      {
        actorId,
        action: "attempt.invalidated",
        entityType: "Attempt",
        entityId: attemptId,
        before: { status: attempt.status },
        after: { status: "INVALIDATED", reason },
      },
      tx as unknown as Parameters<typeof writeAudit>[1],
    );
  });
  // If the attempt was already scored, its result must no longer count. The
  // leaderboard queries exclude attempts with invalidatedAt set, so the result
  // row is retained for audit but is excluded from rankings.
}

export async function releaseAttemptSession(
  attemptId: string,
  actorId: string,
): Promise<void> {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw notFound("Attempt not found.");
  await prisma.$transaction(async (tx) => {
    await tx.attempt.update({ where: { id: attemptId }, data: { sessionId: null } });
    await writeAudit(
      {
        actorId,
        action: "attempt.release_session",
        entityType: "Attempt",
        entityId: attemptId,
        before: { sessionId: attempt.sessionId },
        after: { sessionId: null },
      },
      tx as unknown as Parameters<typeof writeAudit>[1],
    );
  });
}

export function assertPaperIntegrity(paper: Paper): void {
  if (paper.questions.length === 0) {
    throw new AppError(500, "EMPTY_PAPER", "Stored attempt paper has no questions.");
  }
}
