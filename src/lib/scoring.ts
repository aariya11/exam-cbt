// Server-side scoring engine. Pure functions - no I/O - so the marking rules
// that decide student results are unit-testable in isolation.
//
// Rules implemented:
//  - Correct answer: full marks for the question.
//  - Incorrect answer: question's negative marks are applied.
//  - Unanswered: no marks either way.
//  - MULTIPLE_CHOICE questions require an exact match of the correct option
//    set for full marks.
//  - Optional partial credit (only when the exam enables it, and only for
//    MULTIPLE_CHOICE): max(0, (correctSelected - incorrectSelected) / totalCorrect * marks).
//    Partially-correct questions receive no negative marking.

export type ScoringQuestion = {
  questionId: string;
  type: string; // SINGLE_CHOICE | MULTIPLE_CHOICE
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  difficulty: string;
  marks: number;
  negativeMarks: number;
  optionIds: string[];
  correctOptionIds: string[];
};

export type ScoringAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};

export type QuestionOutcome = "correct" | "partial" | "wrong" | "unanswered";

export type GradedQuestion = {
  questionId: string;
  outcome: QuestionOutcome;
  awarded: number;
};

export type SubjectBreakdown = {
  subjectId: string;
  subjectName: string;
  score: number;
  maxScore: number;
  correct: number;
  partial: number;
  wrong: number;
  unanswered: number;
};

export type TopicBreakdown = {
  topicId: string;
  topicName: string;
  score: number;
  maxScore: number;
  correct: number;
  partial: number;
  wrong: number;
  unanswered: number;
};

export type ScoreResult = {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  subjectBreakdown: SubjectBreakdown[];
  topicBreakdown: TopicBreakdown[];
  graded: GradedQuestion[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const sameOptionSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  if (set.size !== a.length) return false;
  for (const item of b) if (!set.has(item)) return false;
  return true;
};

export function scoreAttempt(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
  options: { allowPartialCredit?: boolean } = {},
): ScoreResult {
  const answerByQuestion = new Map<string, string[]>();
  for (const answer of answers) {
    answerByQuestion.set(answer.questionId, answer.selectedOptionIds ?? []);
  }

  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let partialCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const graded: GradedQuestion[] = [];
  const subjectMap = new Map<string, SubjectBreakdown>();
  const topicMap = new Map<string, TopicBreakdown>();

  for (const question of questions) {
    maxScore += question.marks;
    const validOptionIds = new Set(question.optionIds);
    const rawSelected = answerByQuestion.get(question.questionId) ?? [];
    const selected = rawSelected.filter((id) => validOptionIds.has(id));

    const subject = subjectMap.get(question.subjectId) ?? {
      subjectId: question.subjectId,
      subjectName: question.subjectName,
      score: 0,
      maxScore: 0,
      correct: 0,
      partial: 0,
      wrong: 0,
      unanswered: 0,
    };
    subject.maxScore += question.marks;

    const topicKey = question.topicId ?? `subject:${question.subjectId}`;
    const topic = topicMap.get(topicKey) ?? {
      topicId: question.topicId ?? question.subjectId,
      topicName: question.topicName ?? `${question.subjectName} (general)`,
      score: 0,
      maxScore: 0,
      correct: 0,
      partial: 0,
      wrong: 0,
      unanswered: 0,
    };
    topic.maxScore += question.marks;

    let outcome: QuestionOutcome;
    let awarded = 0;

    if (selected.length === 0) {
      outcome = "unanswered";
      unansweredCount += 1;
      subject.unanswered += 1;
      topic.unanswered += 1;
    } else if (sameOptionSet(selected, question.correctOptionIds)) {
      outcome = "correct";
      awarded = question.marks;
      correctCount += 1;
      subject.correct += 1;
      topic.correct += 1;
    } else if (
      options.allowPartialCredit &&
      question.type === "MULTIPLE_CHOICE" &&
      question.correctOptionIds.length > 1
    ) {
      const correctSet = new Set(question.correctOptionIds);
      const correctSelected = selected.filter((id) => correctSet.has(id)).length;
      const incorrectSelected = selected.length - correctSelected;
      const fraction = Math.max(
        0,
        (correctSelected - incorrectSelected) / question.correctOptionIds.length,
      );
      if (fraction > 0) {
        outcome = "partial";
        awarded = round2(question.marks * fraction);
        partialCount += 1;
        subject.partial += 1;
        topic.partial += 1;
      } else {
        outcome = "wrong";
        awarded = -question.negativeMarks;
        wrongCount += 1;
        subject.wrong += 1;
        topic.wrong += 1;
      }
    } else {
      outcome = "wrong";
      awarded = -question.negativeMarks;
      wrongCount += 1;
      subject.wrong += 1;
      topic.wrong += 1;
    }

    score += awarded;
    subject.score += awarded;
    topic.score += awarded;
    graded.push({ questionId: question.questionId, outcome, awarded: round2(awarded) });

    subjectMap.set(question.subjectId, subject);
    topicMap.set(topicKey, topic);
  }

  const attempted = correctCount + partialCount + wrongCount;
  const accuracy = attempted > 0 ? round2((correctCount / attempted) * 100) : 0;
  const percentage = maxScore > 0 ? round2((Math.max(0, score) / maxScore) * 100) : 0;

  const finishNumbers = <T extends { score: number; maxScore: number }>(rows: T[]) =>
    rows.map((row) => ({ ...row, score: round2(row.score), maxScore: round2(row.maxScore) }));

  return {
    score: round2(score),
    maxScore: round2(maxScore),
    percentage,
    correctCount,
    partialCount,
    wrongCount,
    unansweredCount,
    accuracy,
    subjectBreakdown: finishNumbers([...subjectMap.values()]).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName),
    ),
    topicBreakdown: finishNumbers([...topicMap.values()]).sort((a, b) =>
      a.topicName.localeCompare(b.topicName),
    ),
    graded,
  };
}
