import { describe, expect, it } from "vitest";
import { buildPaper, resolveMarks, type PaperPoolQuestion, type PaperSection } from "@/lib/paper";
import { AppError } from "@/lib/errors";

function poolQuestion(id: string, sectionId: string, optionCount = 4): PaperPoolQuestion & { marks: number; negativeMarks: number } {
  return {
    questionId: id,
    sectionId,
    subjectId: "sub-1",
    difficulty: "MEDIUM",
    optionIds: Array.from({ length: optionCount }, (_, index) => `${id}-o${index}`),
    marks: 4,
    negativeMarks: 1,
  };
}

const sections: PaperSection[] = [
  { id: "sec-1", title: "Section A", questionCount: 3, marksPerCorrect: 4, negativeMarksPerWrong: 1 },
  { id: "sec-2", title: "Section B", questionCount: 2, marksPerCorrect: 2, negativeMarksPerWrong: 0.5 },
];

const pool = [
  poolQuestion("q1", "sec-1"),
  poolQuestion("q2", "sec-1"),
  poolQuestion("q3", "sec-1"),
  poolQuestion("q4", "sec-1"),
  poolQuestion("q5", "sec-2"),
  poolQuestion("q6", "sec-2"),
];

describe("paper generation", () => {
  it("selects the configured number of questions per section", () => {
    const paper = buildPaper({ seed: "seed-1", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const sectionACount = paper.questions.filter((question) => question.sectionId === "sec-1").length;
    const sectionBCount = paper.questions.filter((question) => question.sectionId === "sec-2").length;
    expect(sectionACount).toBe(3);
    expect(sectionBCount).toBe(2);
  });

  it("never repeats a question", () => {
    const paper = buildPaper({ seed: "seed-1", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const ids = paper.questions.map((question) => question.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic for a stored seed", () => {
    const first = buildPaper({ seed: "attempt-seed-42", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const second = buildPaper({ seed: "attempt-seed-42", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    expect(second.questions).toEqual(first.questions);
  });

  it("produces different papers for different seeds", () => {
    const first = buildPaper({ seed: "seed-a", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const second = buildPaper({ seed: "seed-b", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const firstOrder = first.questions.map((question) => question.questionId).join(",");
    const secondOrder = second.questions.map((question) => question.questionId).join(",");
    expect(firstOrder).not.toBe(secondOrder);
  });

  it("keeps option order stable when shuffling is disabled", () => {
    const paper = buildPaper({ seed: "seed-1", sections, pool, shuffleQuestions: false, shuffleOptions: false });
    for (const question of paper.questions) {
      const original = pool.find((candidate) => candidate.questionId === question.questionId)!;
      expect(question.optionOrder).toEqual(original.optionIds);
    }
  });

  it("stores shuffled options as a permutation of the real option ids", () => {
    const paper = buildPaper({ seed: "seed-1", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    for (const question of paper.questions) {
      const original = pool.find((candidate) => candidate.questionId === question.questionId)!;
      expect([...question.optionOrder].sort()).toEqual([...original.optionIds].sort());
    }
  });

  it("never embeds correctness data in the stored paper", () => {
    const paper = buildPaper({ seed: "seed-1", sections, pool, shuffleQuestions: true, shuffleOptions: true });
    const serialized = JSON.stringify(paper);
    expect(serialized).not.toContain("isCorrect");
    expect(serialized).not.toContain("correctOption");
  });

  it("rejects papers whose pool cannot fill a section", () => {
    const impossible: PaperSection[] = [
      { id: "sec-1", title: "Section A", questionCount: 5, marksPerCorrect: 4, negativeMarksPerWrong: 1 },
    ];
    try {
      buildPaper({ seed: "seed-1", sections: impossible, pool, shuffleQuestions: true, shuffleOptions: true });
      expect.unreachable("buildPaper should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("INSUFFICIENT_QUESTIONS");
      expect(appError.details).toMatchObject({ required: 5, available: 4 });
    }
  });
});

describe("mark resolution precedence", () => {
  const exam = { marksPerCorrect: 4, negativeMarksPerWrong: 1 };
  const section = { marksPerCorrect: 2, negativeMarksPerWrong: 0.5 };

  it("prefers question-level overrides", () => {
    expect(resolveMarks(exam, section, { marks: 5, negativeMarks: 2 })).toEqual({ marks: 5, negativeMarks: 2 });
  });

  it("falls back to the section configuration", () => {
    expect(resolveMarks(exam, section, { marks: null, negativeMarks: null })).toEqual({
      marks: 2,
      negativeMarks: 0.5,
    });
  });

  it("falls back to the exam defaults", () => {
    expect(resolveMarks(exam, null, { marks: null, negativeMarks: null })).toEqual({
      marks: 4,
      negativeMarks: 1,
    });
  });
});
