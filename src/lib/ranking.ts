// Ranking policy engine (pure functions).
//
// Published policy:
//   1. Higher score ranks first.
//   2. The examination's configured tie-break rules are applied in order.
//   3. If no further tie-break rule applies, equal participants share the same
//      rank (standard competition ranking: 1, 2, 2, 4).
//
// Faster completion is never used as a tie-breaker unless the examination
// explicitly configures TIME_ASC.

import { TIE_BREAK_OPTIONS, type TieBreakRule } from "./constants";

export type { TieBreakRule };

export type RankableRow = {
  userId: string;
  score: number;
  accuracy: number;
  wrongCount: number;
  attempted: number;
  timeUsedSec: number;
};

export function parseTieBreakRules(json: string | null | undefined): TieBreakRule[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TieBreakRule =>
        typeof item === "string" && item in TIE_BREAK_OPTIONS,
    );
  } catch {
    return [];
  }
}

// Negative result means `a` ranks better than `b`.
export function compareRows(a: RankableRow, b: RankableRow, rules: TieBreakRule[]): number {
  if (a.score !== b.score) return b.score - a.score;
  for (const rule of rules) {
    switch (rule) {
      case "ACCURACY_DESC":
        if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy;
        break;
      case "WRONG_ASC":
        if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
        break;
      case "ATTEMPTED_DESC":
        if (a.attempted !== b.attempted) return b.attempted - a.attempted;
        break;
      case "TIME_ASC":
        if (a.timeUsedSec !== b.timeUsedSec) return a.timeUsedSec - b.timeUsedSec;
        break;
    }
  }
  return 0;
}

// Assign ranks to an already policy-ordered page of rows. `betterCountBeforePage`
// is the number of participants ranked strictly better than the first row of
// the page (obtained from an aggregate query), so ranks are absolute.
export function rankPage<T extends RankableRow>(
  rows: T[],
  rules: TieBreakRule[],
  betterCountBeforePage: number,
): Array<T & { rank: number; tied: boolean }> {
  const ranked: Array<T & { rank: number; tied: boolean }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let betterWithinPage = 0;
    for (let j = 0; j < i; j++) {
      if (compareRows(rows[j], row, rules) < 0) betterWithinPage++;
    }
    const rank = betterCountBeforePage + betterWithinPage + 1;
    const tied =
      (i > 0 && compareRows(rows[i - 1], row, rules) === 0) ||
      (i + 1 < rows.length && compareRows(rows[i + 1], row, rules) === 0);
    ranked.push({ ...row, rank, tied });
  }
  return ranked;
}

// Rank movement against a historical rank position: positive means the
// participant moved up (their rank number decreased).
export function rankMovement(currentRank: number, historicalRank: number | null): number | null {
  if (historicalRank === null) return null;
  return historicalRank - currentRank;
}
