/**
 * Standalone sweeper for cron-style schedulers (see README "Operations").
 * Run: npm run sweep
 */
import { prisma } from "../src/lib/db";
import { runSweep } from "../src/lib/sweeper";

runSweep(500)
  .then(async (finalized) => {
    console.info(`[sweep] finalized ${finalized} expired attempt(s)`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[sweep] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
