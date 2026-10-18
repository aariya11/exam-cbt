import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { parsePaper, type Paper } from "@/lib/paper";
import { ATTEMPT_EVENTS, INTEGRITY_ALERT_TYPES } from "@/lib/constants";
import {
  finalizeAttempt,
  finalizeExpiredAttempts,
  loadAttemptForStudent,
  recordAttemptEvent,
  releaseAttemptSession,
  saveAnswerState,
  startOrResumeAttempt,
} from "@/lib/attempt-service";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

type QuestionFixture = { id: string; optionIds: string[]; correctId: string };

let staffId: string;
let studentId: string;
let examMainId: string;
let examLimitedId: string;
let examSweepId: string;
let mainAttemptId: string;
let sweepAttemptId: string;
let limitedAttemptId: string;
const sessionIds: Record<string, string> = {};
const questions: Record<string, QuestionFixture> = {};
const fixtureById: Record<string, QuestionFixture> = {};

async function createSession(userId: string, key: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: `test-session-${key}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  sessionIds[key] = session.id;
  return session.id;
}

async function createQuestion(index: number, subjectId: string, key: string): Promise<QuestionFixture> {
  const question = await prisma.question.create({
    data: {
      subjectId,
      difficulty: "MEDIUM",
      type: "SINGLE_CHOICE",
      text: `Fixture question ${index}?`,
      status: "PUBLISHED",
      source: "vitest fixture",
      license: "test",
      createdById: staffId,
      options: {
        create: Array.from({ length: 4 }, (_, optionIndex) => ({
          text: `Fixture ${index} option ${optionIndex}`,
          isCorrect: optionIndex === 0,
          sortOrder: optionIndex,
        })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  const fixture: QuestionFixture = {
    id: question.id,
    optionIds: question.options.map((option) => option.id),
    correctId: question.options[0].id,
  };
  questions[key] = fixture;
  fixtureById[fixture.id] = fixture;
  return fixture;
}

function wrongOptionId(fixture: QuestionFixture): string {
  return fixture.optionIds.find((id) => id !== fixture.correctId)!;
}

function paperOf(paperJson: string): Paper {
  return parsePaper(paperJson);
}

beforeAll(async () => {
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./test.db" },
    stdio: "pipe",
  });

  const staff = await prisma.user.create({
    data: {
      email: "staff@vitest.local",
      username: "staffv",
      displayName: "Vitest Staff",
      passwordHash: "unused-in-tests",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  staffId = staff.id;

  const student = await prisma.user.create({
    data: {
      email: "student@vitest.local",
      username: "studentv",
      displayName: "Vitest Student",
      passwordHash: "unused-in-tests",
      role: "STUDENT",
      emailVerifiedAt: new Date(),
    },
  });
  studentId = student.id;

  await createSession(staffId, "staff");
  await createSession(studentId, "main-a");
  await createSession(studentId, "main-b");
  await createSession(studentId, "sweep-a");
  await createSession(studentId, "sweep-b");
  await createSession(studentId, "sweep-c");
  await createSession(studentId, "limited-a");

  const category = await prisma.category.create({
    data: { slug: "vitest-category", name: "Vitest Category", description: "Fixture category" },
  });
  const subject = await prisma.subject.create({ data: { slug: "vitest-subject", name: "Vitest Subject" } });

  for (let index = 1; index <= 8; index++) {
    await createQuestion(index, subject.id, `q${index}`);
  }

  async function createExam(key: "main" | "limited" | "sweep", questionKeys: string[], maxAttempts: number | null) {
    const exam = await prisma.exam.create({
      data: {
        slug: `vitest-exam-${key}`,
        title: `Vitest Exam ${key}`,
        description: `Fixture examination for ${key} scenarios.`,
        categoryId: category.id,
        difficulty: "MEDIUM",
        durationMinutes: 30,
        marksPerCorrect: 4,
        negativeMarksPerWrong: 1,
        status: "ACTIVE",
        maxAttempts,
        publishResultsImmediately: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        createdById: staffId,
      },
    });
    const section = await prisma.examSection.create({
      data: {
        examId: exam.id,
        subjectId: subject.id,
        title: "Section A",
        questionCount: questionKeys.length,
        sortOrder: 0,
      },
    });
    for (let index = 0; index < questionKeys.length; index++) {
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          questionId: questions[questionKeys[index]].id,
          sectionId: section.id,
          orderIndex: index,
        },
      });
    }
    return exam.id;
  }

  examMainId = await createExam("main", ["q1", "q2", "q3", "q4"], null);
  examLimitedId = await createExam("limited", ["q5", "q6"], 1);
  examSweepId = await createExam("sweep", ["q7", "q8"], null);
});

async function loadExam(examId: string) {
  return prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { sections: true } });
}

describe("attempt lifecycle", () => {
  it("starts an attempt with a server-generated paper and resumes it afterwards", async () => {
    const started = await startOrResumeAttempt(await loadExam(examMainId), {
      userId: studentId,
      sessionId: sessionIds["main-a"],
      ip: "127.0.0.1",
      userAgent: "vitest",
    });
    mainAttemptId = started.attempt.id;
    expect(started.resumed).toBe(false);
    expect(started.attempt.status).toBe("IN_PROGRESS");

    const paper = paperOf(started.attempt.paperJson);
    expect(paper.questions).toHaveLength(4);
    expect(new Set(paper.questions.map((question) => question.questionId))).toEqual(
      new Set(["q1", "q2", "q3", "q4"].map((key) => questions[key].id)),
    );

    const resumed = await startOrResumeAttempt(await loadExam(examMainId), {
      userId: studentId,
      sessionId: sessionIds["main-a"],
      ip: null,
      userAgent: null,
    });
    expect(resumed.resumed).toBe(true);
    expect(resumed.attempt.id).toBe(started.attempt.id);
  });

  it("rejects answers for questions that are not part of the paper and filters invalid options", async () => {
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: mainAttemptId } });
    const paper = paperOf(attempt.paperJson);
    const first = paper.questions[0];
    const fixture = fixtureById[first.questionId];

    await expect(
      saveAnswerState(attempt, paper, sessionIds["main-a"], { questionId: questions.q5.id, selectedOptionIds: [questions.q5.correctId] }, null),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await saveAnswerState(
      attempt,
      paper,
      sessionIds["main-a"],
      { questionId: first.questionId, selectedOptionIds: [fixture.correctId, "not-a-real-option"] },
      null,
    );
    const stored = await prisma.attemptAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: first.questionId } },
    });
    expect(JSON.parse(stored.selectedOptionIds)).toEqual([fixture.correctId]);
  });

  it("blocks a second concurrent session and records an evidence alert", async () => {
    const started = await startOrResumeAttempt(await loadExam(examSweepId), {
      userId: studentId,
      sessionId: sessionIds["sweep-a"],
      ip: null,
      userAgent: null,
    });
    sweepAttemptId = started.attempt.id;

    await expect(
      loadAttemptForStudent(sweepAttemptId, studentId, sessionIds["sweep-b"], { forWrite: true }),
    ).rejects.toMatchObject({ code: "CONCURRENT_SESSION" });

    const alert = await prisma.integrityAlert.findFirst({
      where: { attemptId: sweepAttemptId, type: INTEGRITY_ALERT_TYPES.CONCURRENT_ACCESS },
    });
    expect(alert).not.toBeNull();
    expect(alert!.status).toBe("OPEN");

    await releaseAttemptSession(sweepAttemptId, staffId);
    const rebound = await loadAttemptForStudent(sweepAttemptId, studentId, sessionIds["sweep-c"], { forWrite: true });
    expect(rebound.attempt.sessionId).toBe(sessionIds["sweep-c"]);
  });

  it("counts focus-loss events as warnings", async () => {
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: sweepAttemptId } });
    await recordAttemptEvent(attempt, ATTEMPT_EVENTS.WINDOW_BLUR, { note: "test" }, null);
    const third = await recordAttemptEvent(attempt, ATTEMPT_EVENTS.VISIBILITY_HIDDEN, { note: "test" }, null);
    expect(third.focusWarnings).toBe(2);
    const reread = await prisma.attempt.findUniqueOrThrow({ where: { id: sweepAttemptId } });
    expect(reread.focusWarnings).toBe(2);
    const eventCount = await prisma.attemptEvent.count({
      where: { attemptId: sweepAttemptId, type: { in: [ATTEMPT_EVENTS.WINDOW_BLUR, ATTEMPT_EVENTS.VISIBILITY_HIDDEN] } },
    });
    expect(eventCount).toBe(2);
  });

  it("lazily finalises attempts whose deadline has passed and rejects further writes", async () => {
    await prisma.attempt.update({
      where: { id: sweepAttemptId },
      data: { deadlineAt: new Date(Date.now() - 60_000) },
    });

    await expect(
      loadAttemptForStudent(sweepAttemptId, studentId, sessionIds["sweep-c"], { forWrite: true }),
    ).rejects.toMatchObject({ code: "ATTEMPT_EXPIRED" });

    const finalized = await prisma.attempt.findUniqueOrThrow({ where: { id: sweepAttemptId } });
    expect(finalized.status).toBe("AUTO_SUBMITTED");
    expect(finalized.finalizeReason).toBe("deadline_exceeded");
    const result = await prisma.result.findUnique({ where: { attemptId: sweepAttemptId } });
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
  });

  it("sweeps expired attempts and enforces attempt limits", async () => {
    const started = await startOrResumeAttempt(await loadExam(examLimitedId), {
      userId: studentId,
      sessionId: sessionIds["limited-a"],
      ip: null,
      userAgent: null,
    });
    limitedAttemptId = started.attempt.id;

    const paper = paperOf(started.attempt.paperJson);
    const fixture = fixtureById[paper.questions[0].questionId];
    await saveAnswerState(
      started.attempt,
      paper,
      sessionIds["limited-a"],
      { questionId: paper.questions[0].questionId, selectedOptionIds: [fixture.correctId] },
      null,
    );

    await prisma.attempt.update({
      where: { id: limitedAttemptId },
      data: { deadlineAt: new Date(Date.now() - 60_000) },
    });
    const swept = await finalizeExpiredAttempts();
    expect(swept).toBeGreaterThanOrEqual(1);
    const finalized = await prisma.attempt.findUniqueOrThrow({ where: { id: limitedAttemptId } });
    expect(finalized.status).toBe("AUTO_SUBMITTED");
    const result = await prisma.result.findUnique({ where: { attemptId: limitedAttemptId } });
    expect(result!.correctCount).toBe(1);
    expect(result!.score).toBe(4);

    await expect(
      startOrResumeAttempt(await loadExam(examLimitedId), {
        userId: studentId,
        sessionId: sessionIds["limited-a"],
        ip: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: "ATTEMPT_LIMIT_REACHED" });
  });

  it("grades a submitted attempt once and stays idempotent", async () => {
    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: mainAttemptId } });
    const paper = paperOf(attempt.paperJson);

    const firstFixture = fixtureById[paper.questions[0].questionId];
    const secondFixture = fixtureById[paper.questions[1].questionId];
    await saveAnswerState(
      attempt,
      paper,
      sessionIds["main-a"],
      { questionId: paper.questions[0].questionId, selectedOptionIds: [firstFixture.correctId] },
      null,
    );
    await saveAnswerState(
      attempt,
      paper,
      sessionIds["main-a"],
      { questionId: paper.questions[1].questionId, selectedOptionIds: [wrongOptionId(secondFixture)] },
      null,
    );

    const outcome = await finalizeAttempt(mainAttemptId, "student_submit");
    expect(outcome.alreadyFinalized).toBe(false);

    const result = await prisma.result.findUniqueOrThrow({ where: { attemptId: mainAttemptId } });
    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(16);
    expect(result.percentage).toBeCloseTo(18.75, 2);
    expect(result.correctCount).toBe(1);
    expect(result.wrongCount).toBe(1);
    expect(result.unansweredCount).toBe(2);
    expect(result.accuracy).toBe(50);
    expect(result.publishedAt).not.toBeNull();
    expect(result.rankSnapshot).toBe(1);

    const again = await finalizeAttempt(mainAttemptId, "student_submit");
    expect(again.alreadyFinalized).toBe(true);
    expect(again.resultId).toBe(outcome.resultId);
    const resultCount = await prisma.result.count({ where: { attemptId: mainAttemptId } });
    expect(resultCount).toBe(1);

    const finalizedAttempt = await prisma.attempt.findUniqueOrThrow({ where: { id: mainAttemptId } });
    expect(finalizedAttempt.status).toBe("SUBMITTED");
    expect(finalizedAttempt.finalizeReason).toBe("student_submit");

    const notificationCount = await prisma.notification.count({ where: { userId: studentId, type: "result" } });
    expect(notificationCount).toBeGreaterThanOrEqual(1);

    const startEventCount = await prisma.attemptEvent.count({
      where: { attemptId: mainAttemptId, type: ATTEMPT_EVENTS.START },
    });
    expect(startEventCount).toBe(1);
  });
});
