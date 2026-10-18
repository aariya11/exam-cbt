import { unprocessable } from "./errors";
import { createRng, shuffle } from "./rng";
import { PAPER_VERSION } from "./constants";

// Exam paper generation.
//
// The entire paper (which questions, in which order, with which option order
// and which marks) is decided server-side from a stored seed, persisted on the
// attempt, and never includes correctness data. Reconstructing the paper from
// the attempt record gives full auditability.

export type PaperQuestion = {
  questionId: string;
  sectionId: string | null;
  optionOrder: string[];
  marks: number;
  negativeMarks: number;
};

export type Paper = {
  version: number;
  seed: string;
  generatedAt: string;
  questions: PaperQuestion[];
};

export type PaperPoolQuestion = {
  questionId: string;
  sectionId: string | null;
  subjectId: string;
  difficulty: string;
  optionIds: string[];
};

export type PaperSection = {
  id: string;
  title: string;
  questionCount: number;
  marksPerCorrect: number;
  negativeMarksPerWrong: number;
};

export type PaperMarks = {
  marks: number;
  negativeMarks: number;
};

export function buildPaper(input: {
  seed: string;
  sections: PaperSection[];
  pool: Array<PaperPoolQuestion & { marks: number; negativeMarks: number }>;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}): Paper {
  const { seed, sections, pool, shuffleQuestions, shuffleOptions } = input;
  const rng = createRng(seed);
  const usedQuestionIds = new Set<string>();
  const questions: PaperQuestion[] = [];

  for (const section of sections) {
    const candidates = pool.filter(
      (q) => q.sectionId === section.id && !usedQuestionIds.has(q.questionId),
    );

    if (candidates.length < section.questionCount) {
      throw unprocessable(
        `Section "${section.title}" has ${candidates.length} eligible question(s) but ${section.questionCount} required.`,
        "INSUFFICIENT_QUESTIONS",
        {
          sectionId: section.id,
          required: section.questionCount,
          available: candidates.length,
        },
      );
    }

    const ordered = shuffleQuestions ? shuffle(candidates, rng) : candidates;
    const chosen = ordered.slice(0, section.questionCount);

    for (const question of chosen) {
      usedQuestionIds.add(question.questionId);
      questions.push({
        questionId: question.questionId,
        sectionId: section.id,
        optionOrder: shuffleOptions ? shuffle(question.optionIds, rng) : question.optionIds,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
      });
    }
  }

  return {
    version: PAPER_VERSION,
    seed,
    generatedAt: new Date().toISOString(),
    questions,
  };
}

export function parsePaper(paperJson: string): Paper {
  const paper = JSON.parse(paperJson) as Paper;
  if (!paper || paper.version !== PAPER_VERSION || !Array.isArray(paper.questions)) {
    throw new Error("Stored exam paper is unreadable.");
  }
  return paper;
}

export function resolveMarks(
  exam: { marksPerCorrect: number; negativeMarksPerWrong: number },
  section: { marksPerCorrect: number | null; negativeMarksPerWrong: number | null } | null,
  examQuestion: { marks: number | null; negativeMarks: number | null },
): PaperMarks {
  return {
    marks: examQuestion.marks ?? section?.marksPerCorrect ?? exam.marksPerCorrect,
    negativeMarks:
      examQuestion.negativeMarks ?? section?.negativeMarksPerWrong ?? exam.negativeMarksPerWrong,
  };
}
