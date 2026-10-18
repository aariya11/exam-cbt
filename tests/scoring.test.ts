import { describe, expect, it } from "vitest";
import { scoreAttempt, type ScoringQuestion } from "@/lib/scoring";

function makeQuestion(overrides: Partial<ScoringQuestion> & { questionId: string }): ScoringQuestion {
  return {
    type: "SINGLE_CHOICE",
    subjectId: "sub-1",
    subjectName: "Physics",
    topicId: "top-1",
    topicName: "Kinematics",
    difficulty: "MEDIUM",
    marks: 4,
    negativeMarks: 1,
    optionIds: ["a", "b", "c", "d"],
    correctOptionIds: ["a"],
    ...overrides,
  };
}

describe("scoring engine", () => {
  it("awards full marks for a correct single-choice answer", () => {
    const result = scoreAttempt([makeQuestion({ questionId: "q1" })], [{ questionId: "q1", selectedOptionIds: ["a"] }]);
    expect(result.score).toBe(4);
    expect(result.maxScore).toBe(4);
    expect(result.correctCount).toBe(1);
    expect(result.percentage).toBe(100);
    expect(result.accuracy).toBe(100);
  });

  it("applies negative marks for a wrong answer", () => {
    const result = scoreAttempt([makeQuestion({ questionId: "q1" })], [{ questionId: "q1", selectedOptionIds: ["b"] }]);
    expect(result.score).toBe(-1);
    expect(result.wrongCount).toBe(1);
    // Percentage never goes below zero.
    expect(result.percentage).toBe(0);
  });

  it("treats unanswered questions as zero, not negative", () => {
    const result = scoreAttempt([makeQuestion({ questionId: "q1" })], []);
    expect(result.score).toBe(0);
    expect(result.unansweredCount).toBe(1);
    expect(result.wrongCount).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  it("treats an answer containing only invalid option ids as unanswered", () => {
    const result = scoreAttempt(
      [makeQuestion({ questionId: "q1" })],
      [{ questionId: "q1", selectedOptionIds: ["not-an-option"] }],
    );
    expect(result.unansweredCount).toBe(1);
    expect(result.score).toBe(0);
  });

  it("requires an exact option set for multi-select questions", () => {
    const multi = makeQuestion({
      questionId: "q2",
      type: "MULTIPLE_CHOICE",
      correctOptionIds: ["a", "c"],
    });
    const exact = scoreAttempt([multi], [{ questionId: "q2", selectedOptionIds: ["c", "a"] }]);
    expect(exact.correctCount).toBe(1);
    expect(exact.score).toBe(4);

    const partialSet = scoreAttempt([multi], [{ questionId: "q2", selectedOptionIds: ["a"] }]);
    expect(partialSet.wrongCount).toBe(1);
    expect(partialSet.score).toBe(-1);
  });

  it("applies partial credit only when the exam enables it", () => {
    const multi = makeQuestion({
      questionId: "q2",
      type: "MULTIPLE_CHOICE",
      correctOptionIds: ["a", "b", "c"],
    });

    const disabled = scoreAttempt([multi], [{ questionId: "q2", selectedOptionIds: ["a", "b"] }]);
    expect(disabled.wrongCount).toBe(1);
    expect(disabled.score).toBe(-1);

    const enabled = scoreAttempt([multi], [{ questionId: "q2", selectedOptionIds: ["a", "b"] }], {
      allowPartialCredit: true,
    });
    expect(enabled.partialCount).toBe(1);
    // (2 - 0) / 3 * 4 = 2.67
    expect(enabled.score).toBeCloseTo(2.67, 2);
    // Partially correct questions carry no negative marking.
    expect(enabled.wrongCount).toBe(0);
  });

  it("penalises incorrect selections inside a partial-credit answer", () => {
    const multi = makeQuestion({
      questionId: "q2",
      type: "MULTIPLE_CHOICE",
      correctOptionIds: ["a", "b", "c"],
      optionIds: ["a", "b", "c", "d"],
    });
    const result = scoreAttempt([multi], [{ questionId: "q2", selectedOptionIds: ["a", "b", "d"] }], {
      allowPartialCredit: true,
    });
    // (2 correct - 1 incorrect) / 3 * 4 = 1.33
    expect(result.partialCount).toBe(1);
    expect(result.score).toBeCloseTo(1.33, 2);
  });

  it("never grants partial credit to single-choice questions", () => {
    const result = scoreAttempt(
      [makeQuestion({ questionId: "q1", correctOptionIds: ["a", "b"] })],
      [{ questionId: "q1", selectedOptionIds: ["a"] }],
      { allowPartialCredit: true },
    );
    expect(result.partialCount).toBe(0);
    expect(result.wrongCount).toBe(1);
  });

  it("aggregates subject and topic breakdowns with a general-topic fallback", () => {
    const questions: ScoringQuestion[] = [
      makeQuestion({ questionId: "q1", subjectId: "s1", subjectName: "Physics", topicId: "t1", topicName: "Kinematics" }),
      makeQuestion({
        questionId: "q2",
        subjectId: "s1",
        subjectName: "Physics",
        topicId: null,
        topicName: null,
        correctOptionIds: ["b"],
      }),
      makeQuestion({ questionId: "q3", subjectId: "s2", subjectName: "Chemistry", topicId: "t2", topicName: "Moles" }),
    ];
    const result = scoreAttempt(questions, [
      { questionId: "q1", selectedOptionIds: ["a"] },
      { questionId: "q2", selectedOptionIds: ["b"] },
    ]);

    const physics = result.subjectBreakdown.find((row) => row.subjectId === "s1");
    expect(physics).toBeDefined();
    expect(physics!.score).toBe(8);
    expect(physics!.maxScore).toBe(8);
    expect(physics!.correct).toBe(2);

    const generalTopic = result.topicBreakdown.find((row) => row.topicName === "Physics (general)");
    expect(generalTopic).toBeDefined();

    const chemistry = result.subjectBreakdown.find((row) => row.subjectId === "s2");
    expect(chemistry!.unanswered).toBe(1);
  });

  it("computes accuracy over attempted questions only", () => {
    const questions: ScoringQuestion[] = [
      makeQuestion({ questionId: "q1" }),
      makeQuestion({ questionId: "q2", correctOptionIds: ["b"] }),
      makeQuestion({ questionId: "q3" }),
    ];
    const result = scoreAttempt(questions, [
      { questionId: "q1", selectedOptionIds: ["a"] },
      { questionId: "q2", selectedOptionIds: ["a"] },
    ]);
    expect(result.accuracy).toBe(50);
    expect(result.unansweredCount).toBe(1);
  });
});
