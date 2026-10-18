// Next.js instrumentation hook: runs once when a server process starts.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startSweeper } = await import("./lib/sweeper");
  startSweeper();
}
