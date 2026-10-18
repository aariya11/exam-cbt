import { ACHIEVEMENTS, type AchievementCode } from "./constants";

// Achievement rules are evaluated at attempt finalisation from real recorded
// performance only. No fabricated or decorative awards.

export type AchievementContext = {
  difficulty: string;
  result: {
    score: number;
    percentage: number;
    accuracy: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    rankSnapshot: number | null;
  };
  questionCount: number;
  completedAttempts: number; // including this one
};

export function evaluateAchievementCodes(ctx: AchievementContext): AchievementCode[] {
  const codes: AchievementCode[] = [];
  const { result, questionCount, difficulty, completedAttempts } = ctx;

  if (completedAttempts >= 1) codes.push("FIRST_ATTEMPT");
  if (completedAttempts >= 5) codes.push("CONSISTENT_FIVE");
  if (questionCount >= 10 && result.percentage >= 100) codes.push("PERFECT_SCORE");
  if (result.accuracy >= 100 && result.correctCount >= 20) codes.push("SHARPSHOOTER");
  if (difficulty === "HARD" && result.percentage >= 50) codes.push("HARD_50");
  if (result.rankSnapshot !== null && result.rankSnapshot <= 10) codes.push("TOP_10");

  return codes;
}

export const achievementByCode = ACHIEVEMENTS;

export function achievementIconName(code: string): string {
  const entry = Object.values(ACHIEVEMENTS).find((a) => a.code === code);
  return entry?.icon ?? "award";
}
