import { tooManyRequests } from "./errors";

// In-process fixed-window rate limiter.
//
// Deployment note: this limiter is per server instance. It is sufficient for a
// single-node pilot deployment and for local development. For a multi-instance
// deployment, replace the store with Redis (the interface below is deliberately
// minimal so the swap is contained): see README "Scaling" section.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = checkRateLimit(key, limit, windowMs);
  if (!result.ok) {
    throw tooManyRequests(
      `Too many requests. Try again in ${result.retryAfterSec} second(s).`,
    );
  }
}

// For tests.
export function resetRateLimits(): void {
  buckets.clear();
}
