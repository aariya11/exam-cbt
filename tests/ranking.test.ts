import { describe, expect, it } from "vitest";
import { compareRows, parseTieBreakRules, rankMovement, rankPage, type RankableRow } from "@/lib/ranking";

function row(overrides: Partial<RankableRow> & { userId: string }): RankableRow {
  return {
    score: 0,
    accuracy: 0,
    wrongCount: 0,
    attempted: 0,
    timeUsedSec: 0,
    ...overrides,
  };
}

describe("ranking engine", () => {
  it("orders by score first", () => {
    const high = row({ userId: "a", score: 90 });
    const low = row({ userId: "b", score: 80 });
    expect(compareRows(high, low, [])).toBeLessThan(0);
    expect(compareRows(low, high, [])).toBeGreaterThan(0);
  });

  it("applies tie-break rules in the configured order", () => {
    const a = row({ userId: "a", score: 80, accuracy: 70, wrongCount: 5 });
    const b = row({ userId: "b", score: 80, accuracy: 60, wrongCount: 1 });

    // With accuracy first, a ranks better.
    expect(compareRows(a, b, ["ACCURACY_DESC"])).toBeLessThan(0);
    // With wrong-answers first, b ranks better.
    expect(compareRows(a, b, ["WRONG_ASC"])).toBeGreaterThan(0);
  });

  it("respects the order of multiple tie-break rules", () => {
    const a = row({ userId: "a", score: 50, accuracy: 60, wrongCount: 2, attempted: 10 });
    const b = row({ userId: "b", score: 50, accuracy: 60, wrongCount: 1, attempted: 8 });
    // Both rules applied: accuracy ties, then fewer wrong answers wins.
    expect(compareRows(a, b, ["ACCURACY_DESC", "WRONG_ASC"])).toBeGreaterThan(0);
    // Only accuracy applied: tie.
    expect(compareRows(a, b, ["ACCURACY_DESC"])).toBe(0);
  });

  it("uses time as a tie-breaker only when the exam configures it", () => {
    const fast = row({ userId: "a", score: 50, timeUsedSec: 100 });
    const slow = row({ userId: "b", score: 50, timeUsedSec: 500 });
    expect(compareRows(fast, slow, [])).toBe(0);
    expect(compareRows(fast, slow, ["TIME_ASC"])).toBeLessThan(0);
  });

  it("assigns shared ranks for fully tied rows", () => {
    const rows = [
      row({ userId: "a", score: 90 }),
      row({ userId: "b", score: 80 }),
      row({ userId: "c", score: 80 }),
      row({ userId: "d", score: 70 }),
    ];
    const ranked = rankPage(rows, [], 0);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 2, 4]);
    expect(ranked.map((entry) => entry.tied)).toEqual([false, true, true, false]);
  });

  it("offsets ranks by participants ranked better before the page", () => {
    const rows = [row({ userId: "a", score: 60 }), row({ userId: "b", score: 50 })];
    const ranked = rankPage(rows, [], 10);
    expect(ranked.map((entry) => entry.rank)).toEqual([11, 12]);
  });

  it("recomputes ranks against tie-break rules within a page", () => {
    const rows = [
      row({ userId: "a", score: 80, accuracy: 90 }),
      row({ userId: "b", score: 80, accuracy: 60 }),
    ];
    const ranked = rankPage(rows, ["ACCURACY_DESC"], 0);
    expect(ranked[0].userId).toBe("a");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("parses only whitelisted tie-break rules", () => {
    expect(parseTieBreakRules('["ACCURACY_DESC","NOPE","TIME_ASC"]')).toEqual(["ACCURACY_DESC", "TIME_ASC"]);
    expect(parseTieBreakRules("not json")).toEqual([]);
    expect(parseTieBreakRules(null)).toEqual([]);
    expect(parseTieBreakRules('{"rule":"ACCURACY_DESC"}')).toEqual([]);
  });

  it("computes rank movement", () => {
    expect(rankMovement(5, 12)).toBe(7);
    expect(rankMovement(20, 3)).toBe(-17);
    expect(rankMovement(1, null)).toBeNull();
  });
});
