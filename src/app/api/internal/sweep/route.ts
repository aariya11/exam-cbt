import { fail, handle, ok } from "@/lib/api";
import { runSweep } from "@/lib/sweeper";

// Cron / external scheduler entry point. Protected by a shared secret
// (SWEEP_TOKEN). The sweeper finalises attempts whose server-side deadline has
// passed, so results exist even if the candidate's device vanished.
export const POST = handle(async (req: Request) => {
  const token = req.headers.get("x-sweep-token");
  const expected = process.env.SWEEP_TOKEN;
  if (!expected || !token || token !== expected) {
    return fail(401, "UNAUTHORIZED", "Invalid sweep token.");
  }
  const finalized = await runSweep(200);
  return ok({ finalized, sweptAt: new Date().toISOString() });
});
