import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 3100);
const externalBase = process.env.BASE_URL ?? null;
const baseUrl = externalBase ?? `http://localhost:${port}`;

const jar = new Map();
let registeredPassword = null;
let serverProc = null;

function absorb(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const cookie of raw) {
    const pair = cookie.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(pathname, options = {}) {
  const {
    method = "GET",
    body,
    withCookie = true,
    origin = true,
    redirect = "manual",
    timeoutMs = 20000,
  } = options;
  const res = await fetch(new URL(pathname, baseUrl), {
    method,
    redirect,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(origin ? { origin: baseUrl } : {}),
      "user-agent": "rankforge-e2e/1.0",
      ...(withCookie && jar.size > 0 ? { cookie: cookieHeader() } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let passed = 0;
let failed = 0;
const failures = [];

async function step(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForServer(deadlineMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    try {
      const res = await fetch(new URL("/login", baseUrl), {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status < 500) return;
    } catch {
      /* server not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become ready at ${baseUrl} within ${deadlineMs}ms`);
}

async function startServer() {
  if (externalBase) return;
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  serverProc = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  });
  let output = "";
  serverProc.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  serverProc.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  serverProc.on("exit", (code) => {
    if (code && code !== 0 && serverProc.exitExpected !== true) {
      console.log(output.split("\n").slice(-20).join("\n"));
    }
  });
  await waitForServer();
}

function stopServer() {
  if (!serverProc) return;
  serverProc.exitExpected = true;
  serverProc.kill();
  serverProc = null;
}

async function main() {
  if (!externalBase && !fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
    throw new Error("No production build found. Run `npm run build` first.");
  }

  console.log(`RankForge end-to-end check against ${baseUrl}`);
  await startServer();

  const stamp = Date.now().toString(36);
  const email = `e2e.${stamp}@rankforge.test`;
  const username = `e2e_${stamp}`;
  const password = "RankForge!E2e1";
  let accountOwned = false;
  let examId = null;
  let attemptId = null;

  await step("register a fresh student account and open a session", async () => {
    const res = await request("/api/auth/register", {
      method: "POST",
      body: {
        email,
        username,
        displayName: "E2E Runner",
        password,
        state: "Maharashtra",
        city: "Pune",
        acceptTerms: true,
      },
    });

    const registrationBlocked =
      res.status === 429 || (res.status === 403 && res.text.includes("registrations"));
    if (registrationBlocked) {
      console.log(`       register unavailable (${res.status}); falling back to the seeded demo student`);
      const login = await request("/api/auth/login", {
        method: "POST",
        body: { identifier: "demo_aarti@demo.rankforge.local", password: "RankForge!Demo1" },
      });
      assert(login.status === 200, `demo fallback login returned ${login.status}: ${login.text.slice(0, 200)}`);
      assert(jar.has("rf_session"), "demo fallback login did not set a session cookie");
      return;
    }

    assert(res.status === 201, `expected 201, got ${res.status}: ${res.text.slice(0, 300)}`);
    assert(res.json?.user?.username === username, "register response is missing the new user");
    assert(jar.has("rf_session"), "register did not set a session cookie");
    accountOwned = true;
    registeredPassword = password;

    const session = await request("/api/auth/session");
    assert(session.status === 200, `session check returned ${session.status}`);
    assert(session.json?.authenticated === true, "session is not authenticated after register");

    if (res.json?.user?.emailVerified !== true) {
      const token = String(res.json?.devVerificationUrl ?? "").split("token=")[1];
      assert(token, "account is not auto-verified and no dev token was exposed");
      const verify = await request("/api/auth/verify-email", { method: "POST", body: { token } });
      assert(verify.status === 200, `email verification returned ${verify.status}`);
    }
  });

  await step("list active examinations", async () => {
    const res = await request("/api/exams");
    assert(res.status === 200, `expected 200, got ${res.status}`);
    const exams = res.json?.exams ?? [];
    assert(Array.isArray(exams) && exams.length > 0, "no active examinations were returned");
    assert(exams[0].id && exams[0].title, "exam payload is missing id/title");
    examId = exams[0].id;
  });

  await step("start an attempt with a server-generated paper", async () => {
    const candidates = (await request("/api/exams")).json?.exams ?? [];
    let lastError = "no examinations available";
    for (const exam of candidates.slice(0, 6)) {
      const res = await request("/api/attempts", { method: "POST", body: { examId: exam.id } });
      if (res.status === 201) {
        attemptId = res.json?.attemptId;
        examId = exam.id;
        assert(attemptId, "start response is missing attemptId");
        return;
      }
      lastError = `${res.status}: ${res.text.slice(0, 200)}`;
      if (res.status !== 409 && res.status !== 429) break;
    }
    throw new Error(`could not start an attempt (${lastError})`);
  });

  let questions = [];
  await step("load runner state without leaking correctness", async () => {
    const res = await request(`/api/attempts/${attemptId}`);
    assert(res.status === 200, `expected 200, got ${res.status}: ${res.text.slice(0, 200)}`);
    const view = res.json;
    assert(view?.attempt?.status === "IN_PROGRESS", `unexpected attempt status ${view?.attempt?.status}`);
    questions = view?.questions ?? [];
    assert(questions.length >= 1, "paper has no questions");
    assert(Array.isArray(questions[0].options) && questions[0].options.length >= 2, "question options missing");
    assert(!res.text.includes("correctOptionIds"), "runner payload leaked correctOptionIds");
    assert(!res.text.includes('"isCorrect"'), "runner payload leaked isCorrect flags");
    assert(new Date(view.attempt.deadlineAt).getTime() > Date.now(), "deadline is already in the past");
  });

  await step("save an answer and record an integrity event", async () => {
    const target = questions[0];
    const save = await request(`/api/attempts/${attemptId}/answers`, {
      method: "PUT",
      body: {
        questionId: target.questionId,
        selectedOptionIds: [target.options[0].id],
        visited: true,
      },
    });
    assert(save.status === 200 && save.json?.saved === true, `save answer returned ${save.status}: ${save.text.slice(0, 200)}`);

    const event = await request(`/api/attempts/${attemptId}/events`, {
      method: "POST",
        body: { type: "window_blur", detail: { note: "e2e" } },
    });
    assert(event.status < 300, `event recording returned ${event.status}`);
  });

  await step("reject answers for questions outside the paper", async () => {
    const res = await request(`/api/attempts/${attemptId}/answers`, {
      method: "PUT",
      body: { questionId: "not-a-real-question", selectedOptionIds: ["nope"] },
    });
    assert(res.status === 404 || res.status === 422, `expected rejection, got ${res.status}`);
  });

  await step("submit, grade once, and lock further writes", async () => {
    const first = await request(`/api/attempts/${attemptId}/submit`, { method: "POST", body: {} });
    assert(first.status === 200, `submit returned ${first.status}: ${first.text.slice(0, 200)}`);
    assert(first.json?.resultId, "submit response is missing resultId");
    assert(first.json?.status === "SUBMITTED", `unexpected status ${first.json?.status}`);

    const second = await request(`/api/attempts/${attemptId}/submit`, { method: "POST", body: {} });
    assert(second.status === 200 && second.json?.alreadyFinalized === true, "second submit was not idempotent");
    assert(second.json?.resultId === first.json.resultId, "idempotent submit returned a different result");

    const write = await request(`/api/attempts/${attemptId}/answers`, {
      method: "PUT",
      body: { questionId: questions[0].questionId, selectedOptionIds: [questions[0].options[1].id] },
    });
    assert(write.status === 409, `expected 409 on post-submit write, got ${write.status}`);
  });

  await step("serve the result page from the graded attempt", async () => {
    const res = await request(`/attempt/${attemptId}/result`);
    assert(res.status === 200, `result page returned ${res.status}`);
  });

  await step("show the examination leaderboard", async () => {
    const res = await request(`/api/leaderboards?scope=EXAM&examId=${encodeURIComponent(examId)}`);
    assert(res.status === 200, `expected 200, got ${res.status}: ${res.text.slice(0, 200)}`);
    assert(Array.isArray(res.json?.entries), "leaderboard response is missing entries");
  });

  await step("update the profile and opt out of public rankings", async () => {
    const patch = await request("/api/profile", {
      method: "PATCH",
      body: { displayName: "E2E Runner", leaderboardOptOut: true },
    });
    assert(patch.status === 200 && patch.json?.updated === true, `profile patch returned ${patch.status}`);

    const profile = await request("/api/profile");
    assert(profile.status === 200 && profile.json?.user?.leaderboardOptOut === true, "profile did not persist opt-out");
  });

  await step("deny anonymous access to protected resources", async () => {
    const saved = new Map(jar);
    jar.clear();
    try {
      const api = await request(`/api/attempts/${attemptId}`, { withCookie: false });
      assert(api.status === 401, `expected 401, got ${api.status}`);
      const page = await request("/admin", { withCookie: false });
      assert(page.status === 307 || page.status === 302, `expected a redirect, got ${page.status}`);
    } finally {
      jar.clear();
      for (const [k, v] of saved) jar.set(k, v);
    }
  });

  await step("deny students on staff-only interfaces", async () => {
    const users = await request("/api/admin/users");
    assert(users.status === 403, `expected 403 from /api/admin/users, got ${users.status}`);
    const settings = await request("/api/admin/settings", { method: "PATCH", body: { registrationOpen: true } });
    assert(settings.status === 403, `expected 403 from /api/admin/settings, got ${settings.status}`);
  });

  await step("delete the account and end the session", async () => {
    if (!accountOwned) {
      console.log("       skipped: this run used the shared demo account");
      return;
    }
    const res = await request("/api/profile", {
      method: "DELETE",
      body: { password: registeredPassword, confirm: "DELETE" },
    });
    assert(res.status === 200 && res.json?.deleted === true, `delete returned ${res.status}: ${res.text.slice(0, 200)}`);
    const session = await request("/api/auth/session", { withCookie: false });
    assert(session.status === 200 && session.json?.authenticated === false, "session still authenticated after deletion");
  });
}

try {
  await main();
} catch (error) {
  failed += 1;
  failures.push("bootstrap");
  console.log(`  FAIL bootstrap`);
  console.log(`       ${error instanceof Error ? error.message : String(error)}`);
} finally {
  stopServer();
}

const total = passed + failed;
console.log(`\n${passed}/${total} steps passed${failed > 0 ? ` — failed: ${failures.join(", ")}` : ""}`);
process.exit(failed > 0 ? 1 : 0);
