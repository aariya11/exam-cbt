import type { Attempt, Exam } from "@prisma/client";
import { prisma } from "./db";
import { notFound } from "./errors";
import { parsePaper } from "./paper";

// Serialisation of attempt state for the examination runner and result pages.
// Correct answers and explanations are only ever included when the attempt is
// finalised, results are published, and the examination permits solution
// release.

export type RunnerOption = { id: string; text: string };

export type RunnerQuestion = {
  questionId: string;
  order: number;
  sectionId: string | null;
  sectionTitle: string;
  subjectName: string;
  difficulty: string;
  type: string;
  text: string;
  imageUrl: string | null;
  marks: number;
  negativeMarks: number;
  options: RunnerOption[];
  correctOptionIds?: string[];
  explanation?: string | null;
};

export type AttemptAnswerState = {
  selectedOptionIds: string[];
  markedForReview: boolean;
  visited: boolean;
};

export type AttemptStateView = {
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
    finalizeReason: string | null;
    focusWarnings: number;
  };
  exam: {
    id: string;
    slug: string;
    title: string;
    difficulty: string;
    durationMinutes: number;
    marksPerCorrect: number;
    negativeMarksPerWrong: number;
    maxFocusWarnings: number;
    requiresDesktop: boolean;
    revealSolutions: boolean;
    instructions: string | null;
  };
  questions: RunnerQuestion[];
  answers: Record<string, AttemptAnswerState>;
  serverTime: string;
  resultId: string | null;
  resultPublished: boolean;
};

export function isResultPublished(
  attempt: Attempt,
  result: { publishedAt: Date | null } | null,
): boolean {
  return attempt.status !== "IN_PROGRESS" && !!result?.publishedAt;
}

export async function buildAttemptStateView(
  attempt: Attempt,
  exam: Exam,
): Promise<AttemptStateView> {
  const paper = parsePaper(attempt.paperJson);

  const [questions, answers, sections, result] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: paper.questions.map((q) => q.questionId) } },
      include: { options: true, subject: true },
    }),
    prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    prisma.examSection.findMany({ where: { examId: exam.id }, orderBy: { sortOrder: "asc" } }),
    prisma.result.findUnique({ where: { attemptId: attempt.id } }),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
  const finalized = attempt.status !== "IN_PROGRESS";
  const revealSolutions = finalized && exam.revealSolutions && !!result?.publishedAt;

  const runnerQuestions: RunnerQuestion[] = paper.questions.flatMap((paperQuestion, index) => {
    const question = questionById.get(paperQuestion.questionId);
    if (!question) return [];
    const optionById = new Map(question.options.map((o) => [o.id, o]));
    const options = paperQuestion.optionOrder.flatMap((id) => {
      const option = optionById.get(id);
      return option ? [{ id: option.id, text: option.text }] : [];
    });
    const view: RunnerQuestion = {
      questionId: question.id,
      order: index + 1,
      sectionId: paperQuestion.sectionId,
      sectionTitle: paperQuestion.sectionId
        ? (sectionTitle.get(paperQuestion.sectionId) ?? "")
        : "",
      subjectName: question.subject.name,
      difficulty: question.difficulty,
      type: question.type,
      text: question.text,
      imageUrl: question.imageUrl,
      marks: paperQuestion.marks,
      negativeMarks: paperQuestion.negativeMarks,
      options,
    };
    if (revealSolutions) {
      view.correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
      view.explanation = question.explanation;
    }
    return [view];
  });

  const answersMap: Record<string, AttemptAnswerState> = {};
  for (const answer of answers) {
    answersMap[answer.questionId] = {
      selectedOptionIds: JSON.parse(answer.selectedOptionIds) as string[],
      markedForReview: answer.markedForReview,
      visited: answer.visited,
    };
  }

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      finalizeReason: attempt.finalizeReason,
      focusWarnings: attempt.focusWarnings,
    },
    exam: {
      id: exam.id,
      slug: exam.slug,
      title: exam.title,
      difficulty: exam.difficulty,
      durationMinutes: exam.durationMinutes,
      marksPerCorrect: exam.marksPerCorrect,
      negativeMarksPerWrong: exam.negativeMarksPerWrong,
      maxFocusWarnings: exam.maxFocusWarnings,
      requiresDesktop: exam.requiresDesktop,
      revealSolutions: exam.revealSolutions,
      instructions: exam.instructions,
    },
    questions: runnerQuestions,
    answers: answersMap,
    serverTime: new Date().toISOString(),
    resultId: result?.id ?? null,
    resultPublished: isResultPublished(attempt, result),
  };
}

export type ResultQuestionReview = RunnerQuestion & {
  selectedOptionIds: string[];
  outcome: "correct" | "partial" | "wrong" | "unanswered";
  awarded: number;
};

export type ResultView = {
  attemptId: string;
  examSlug: string;
  examTitle: string;
  difficulty: string;
  status: string;
  finalizeReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  published: boolean;
  resultsPublishAt: string | null;
  revealSolutions: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  accuracy: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeUsedSec: number;
  rankSnapshot: number | null;
  totalParticipants: number | null;
  subjectBreakdown: Array<{
    subjectId: string;
    subjectName: string;
    score: number;
    maxScore: number;
    correct: number;
    partial: number;
    wrong: number;
    unanswered: number;
  }>;
  topicBreakdown: Array<{
    topicId: string;
    topicName: string;
    score: number;
    maxScore: number;
    correct: number;
    partial: number;
    wrong: number;
    unanswered: number;
  }>;
  review: ResultQuestionReview[] | null;
};

export async function getResultView(attemptId: string, userId: string): Promise<ResultView> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { exam: true, result: true },
  });
  if (!attempt || attempt.userId !== userId) throw notFound("Result not found.");

  if (!attempt.result) {
    throw notFound("This attempt has not been scored yet.");
  }
  const result = attempt.result;
  const exam = attempt.exam;
  const published = !!result.publishedAt;

  let review: ResultQuestionReview[] | null = null;
  if (published && exam.revealSolutions) {
    const state = await buildAttemptStateView(attempt, exam);
    const gradedById = new Map<string, { outcome: ResultQuestionReview["outcome"]; awarded: number }>();
    // Per-question grading is recomputed from stored data for display; the
    // authoritative totals remain the stored Result row.
    const paper = parsePaper(attempt.paperJson);
    const answers = await prisma.attemptAnswer.findMany({ where: { attemptId } });
    const answerMap = new Map(
      answers.map((a) => [a.questionId, JSON.parse(a.selectedOptionIds) as string[]]),
    );
    const questionRows = await prisma.question.findMany({
      where: { id: { in: paper.questions.map((q) => q.questionId) } },
      include: { options: true },
    });
    const correctById = new Map(
      questionRows.map((q) => [q.id, q.options.filter((o) => o.isCorrect).map((o) => o.id)]),
    );

    review = state.questions.map((question) => {
      const selected = answerMap.get(question.questionId) ?? [];
      const correct = correctById.get(question.questionId) ?? [];
      const set = new Set(correct);
      const selectedSet = new Set(selected);
      const exact =
        selected.length === correct.length && correct.every((id) => selectedSet.has(id));
      let outcome: ResultQuestionReview["outcome"];
      let awarded: number;
      if (selected.length === 0) {
        outcome = "unanswered";
        awarded = 0;
      } else if (exact) {
        outcome = "correct";
        awarded = question.marks;
      } else if (exam.allowPartialCredit && question.type === "MULTIPLE_CHOICE" && correct.length > 1) {
        const correctSelected = selected.filter((id) => set.has(id)).length;
        const incorrectSelected = selected.length - correctSelected;
        const fraction = Math.max(0, (correctSelected - incorrectSelected) / correct.length);
        outcome = fraction > 0 ? "partial" : "wrong";
        awarded = fraction > 0 ? Math.round(question.marks * fraction * 100) / 100 : -question.negativeMarks;
      } else {
        outcome = "wrong";
        awarded = -question.negativeMarks;
      }
      gradedById.set(question.questionId, { outcome, awarded });
      return {
        ...question,
        selectedOptionIds: selected,
        outcome,
        awarded,
      };
    });
  }

  const totalParticipants = result.rankSnapshot !== null
    ? await prisma.result.count({ where: { examId: attempt.examId, publishedAt: { not: null } } })
    : null;

  return {
    attemptId: attempt.id,
    examSlug: exam.slug,
    examTitle: exam.title,
    difficulty: exam.difficulty,
    status: attempt.status,
    finalizeReason: attempt.finalizeReason,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    published,
    resultsPublishAt: exam.resultsPublishAt?.toISOString() ?? null,
    revealSolutions: exam.revealSolutions,
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    accuracy: result.accuracy,
    correctCount: result.correctCount,
    partialCount: 0,
    wrongCount: result.wrongCount,
    unansweredCount: result.unansweredCount,
    timeUsedSec: result.timeUsedSec,
    rankSnapshot: result.rankSnapshot,
    totalParticipants,
    subjectBreakdown: JSON.parse(result.subjectBreakdown) as ResultView["subjectBreakdown"],
    topicBreakdown: JSON.parse(result.topicBreakdown) as ResultView["topicBreakdown"],
    review,
  };
}
