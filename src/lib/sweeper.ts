import { finalizeExpiredAttempts } from "./attempt-service";

// Finalises attempts whose deadline passed but which the client never
// submitted (closed tab, lost device, network failure). Finalisation is
// idempotent, so running the sweeper on every instance is safe.
//
// The sweeper is a safety net, not the primary deadline mechanism: every
// attempt read/write path already finalises lazily when the server clock is
// past the deadline.

let started = false;

export function startSweeper(): void {
  if (started) return;
  if (process.env.SWEEPER_ENABLED !== "true") return;
  const interval = Number(process.env.SWEEPER_INTERVAL_MS ?? "60000") || 60000;
  started = true;

  const timer = setInterval(() => {
    void runSweep().catch((error) => console.error("[sweeper] sweep failed", error));
  }, interval);
  if (typeof timer.unref === "function") timer.unref();
  console.info(`[sweeper] started with interval ${interval}ms`);
}

export async function runSweep(limit = 100): Promise<number> {
  return finalizeExpiredAttempts(limit);
}
