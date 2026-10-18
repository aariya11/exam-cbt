/**
 * QA script: exercises the leaderboard engine across every scope against the
 * current database and prints results. Run: npm run check:leaderboards
 */
import { prisma } from "../src/lib/db";
import { getLeaderboard } from "../src/lib/leaderboard";
import { parseTieBreakRules } from "../src/lib/ranking";

async function main() {
  const exam = await prisma.exam.findFirstOrThrow({
    where: { slug: "neet-medium-mock-1" },
    include: { category: true },
  });
  const tieBreak = parseTieBreakRules(exam.tieBreakRules);
  const subject = await prisma.subject.findFirstOrThrow({ where: { name: "Biology" } });

  const examBoard = await getLeaderboard({ scope: "EXAM", examId: exam.id, tieBreakRules: tieBreak });
  console.info(`\nEXAM scope (${exam.title}): ${examBoard.total} participants`);
  for (const entry of examBoard.entries) {
    console.info(
      `  #${entry.rank}${entry.tied ? " (tied)" : ""} ${entry.username} ${entry.score}/${entry.maxScore} pct=${entry.percentage} acc=${entry.accuracy} t=${entry.timeUsedSec}s ${entry.isDemo ? "[demo]" : ""}`,
    );
  }

  const categoryBoard = await getLeaderboard({
    scope: "CATEGORY",
    categoryId: exam.categoryId,
    tieBreakRules: tieBreak,
  });
  console.info(`\nCATEGORY scope (${exam.category.name}): ${categoryBoard.total} participants`);
  for (const entry of categoryBoard.entries.slice(0, 8)) {
    console.info(
      `  #${entry.rank}${entry.tied ? " (tied)" : ""} ${entry.username} score=${entry.score} pct=${entry.percentage} exams=${entry.examCount}`,
    );
  }

  const subjectBoard = await getLeaderboard({
    scope: "SUBJECT",
    examId: exam.id,
    subjectId: subject.id,
    tieBreakRules: tieBreak,
  });
  console.info(`\nSUBJECT scope (${exam.title} / ${subject.name}): ${subjectBoard.total} participants`);
  for (const entry of subjectBoard.entries.slice(0, 5)) {
    console.info(`  #${entry.rank} ${entry.username} pct=${entry.percentage} acc=${entry.accuracy}`);
  }

  const dailyBoard = await getLeaderboard({
    scope: "EXAM",
    examId: exam.id,
    period: "DAILY",
    tieBreakRules: tieBreak,
  });
  console.info(`\nDAILY window (${exam.title}): ${dailyBoard.total} participants`);

  const searchBoard = await getLeaderboard({
    scope: "EXAM",
    examId: exam.id,
    search: "aarti",
    tieBreakRules: tieBreak,
  });
  console.info(`SEARCH "aarti": ${searchBoard.total} participants, first=${searchBoard.entries[0]?.username}`);

  const stateBoard = await getLeaderboard({
    scope: "EXAM",
    examId: exam.id,
    state: "Delhi",
    tieBreakRules: tieBreak,
  });
  console.info(`STATE "Delhi": ${stateBoard.total} participants`);

  const series = await prisma.examSeries.findFirstOrThrow({ where: { slug: "neet-mock-series-1" } });
  const seriesBoard = await getLeaderboard({ scope: "SERIES", seriesId: series.id, tieBreakRules: tieBreak });
  console.info(`\nSERIES scope (${series.name}, formula=${series.formula}): ${seriesBoard.total} participants`);
  for (const entry of seriesBoard.entries.slice(0, 5)) {
    console.info(`  #${entry.rank} ${entry.username} pct=${entry.percentage} exams=${entry.examCount}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
