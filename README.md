# RankForge

A national computer-based testing (CBT) platform: timed examinations with
server-authoritative grading, live leaderboards with configurable tie-breaks,
integrity monitoring, and a full staff/admin panel.

Built as a production-shaped application, not a mockup: real authentication,
real persistence, real scoring, real audit trail. Development runs entirely on
SQLite so it works anywhere; production is designed for PostgreSQL.

## Feature overview

**Public** — landing page, exam catalogue with search/filter, exam detail pages,
global and per-exam leaderboards, about/contact/legal pages.

**Accounts** — registration with consent capture, email verification (token
flow), password reset, profile management, account deletion (with password
confirmation), optional leaderboard opt-out.

**Exam runner** — server-generated question paper per attempt (deterministic
seeded shuffle), countdown synchronised to the server clock, per-question
answers and marked-for-review state with autosave, reconnection resume,
focus/visibility/fullscreen integrity events, deadline grace period, automatic
submission by a sweeper for abandoned attempts.

**Scoring & ranking** — grading runs once server-side (idempotent finalise),
supports negative marking, marks-per-correct overrides, partial credit for
multi-select, exam- and question-level overrides. Results are published per
exam by staff. Leaderboards support exam/category/difficulty/series/subject
scopes, daily/weekly/monthly periods, configurable tie-break ordering
(score, accuracy, time used, negative marks avoided, earliest submission) with
shared ranks for genuine ties.

**Staff & admin panel** (`/admin`) — role-aware access (QUESTION_EDITOR →
QUESTION_REVIEWER → ADMIN → SUPER_ADMIN):

- Dashboard with live platform statistics.
- Question bank: create/edit, topic and subject classification, five-stage
  review workflow (draft → in review → approved → published → retired), version
  history, immutability after publish, bulk CSV import with validation report.
- Examinations: create/edit, lifecycle (draft → active → archived), section
  composition, question assignment with subject matching, publish/unpublish
  results, invalid-question handling with automatic regrade.
- Users: search, role management (SUPER_ADMIN), suspend/reactivate.
- Integrity alerts from concurrent-session and focus anomalies, with resolution
  notes.
- Attempt review: per-attempt timeline, integrity events, answers, result.
- Audit log of every privileged action with before/after snapshots.
- Platform settings (registration toggle, maintenance mode) and CSV exports.

## Tech stack

Next.js 16 (App Router, server components) · React 19 · TypeScript 5.9 ·
Prisma 6 (SQLite for dev, PostgreSQL for production) · Zod 4 · Tailwind CSS 4 ·
KaTeX · Vitest 5. No component library — a small in-house design system lives
in `src/components/ui`.

## Getting started

```bash
npm install
```

Create `.env` (values shown are the development defaults):

```ini
DATABASE_URL="file:./dev.db"
SESSION_PEPPER="change-me-to-a-long-random-string"
APP_URL="http://localhost:3000"
AUTH_AUTO_VERIFY_EMAIL=true
AUTH_DEV_EXPOSE_TOKENS=true
DEADLINE_GRACE_SECONDS=2
SWEEPER_ENABLED=true
SWEEP_TOKEN="dev-sweep-token"
SEED_DEMO_DATA=true
```

Prepare the database and seed it:

```bash
npm run db:push
npm run db:seed
```

Start developing:

```bash
npm run dev
```

### Seeded accounts (development)

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | `admin@rankforge.local` | `RankForge!Admin1` |
| ADMIN | `manager@rankforge.local` | `RankForge!Admin1` |
| QUESTION_EDITOR | `editor@rankforge.local` | `RankForge!Admin1` |
| Student (demo) | `demo_aarti@demo.rankforge.local` | `RankForge!Demo1` |

The seed also creates ~216 published questions, 18 active examinations across
categories, and ~60 graded attempts so leaderboards are populated on first run.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (port 3000) |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + integration suite (43 tests) |
| `npm run e2e` | End-to-end HTTP flow against a production build |
| `npm run db:push` / `db:migrate` | Apply schema (push for dev, migrate for versioned) |
| `npm run db:seed` | Seed reference + demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run sweep` | Deadline sweeper (finalise expired attempts; cron in production) |

The e2e suite starts its own server on port 3100, registers a throwaway
account, runs the full student journey (register → exam → attempt → answer →
submit → result → leaderboard → profile → RBAC denials → account deletion), and
cleans up after itself. If registration is paused or rate-limited it falls back
to a seeded demo student. Run `npm run build` first; set `BASE_URL` to target a
running server instead of spawning one.

## Architecture

```
src/
  app/                 Next.js App Router
    (marketing)/       Public pages
    api/               JSON APIs (auth, attempts, exams, leaderboards, profile, admin, internal)
    admin/             Staff panel (server-guarded, role-filtered UI)
    attempt/[id]/      Exam runner and result page
    dashboard/         Student dashboard
  components/          Design system (ui/), runner, admin, dashboard components
  lib/                 Domain logic: attempt-service, scoring, ranking, leaderboard,
                       paper, regrade, sweeper, auth-core, audit, rate-limit, settings
prisma/                Schema, migrations, seed
tests/                 Vitest unit + integration tests
scripts/               Seed/sweep/e2e entrypoints
```

Key decisions:

- **Server-authoritative timing.** Attempt deadlines are computed and enforced
  server-side; client clocks are never trusted. A `DEADLINE_GRACE_SECONDS`
  grace period absorbs network latency.
- **Frozen papers.** Each attempt stores a paper snapshot (question and option
  IDs, order, marks). Editing a question afterwards cannot change what a
  student saw, and published questions are immutable.
- **Idempotent finalisation.** Submit, sweeper and lazy expiry all funnel into
  one transactional finalise that grades exactly once and is safe under
  concurrency.
- **Unwrapped JSON APIs.** Success responses are the payload itself; errors are
  `{ "error": { "code", "message", "details?" } }` with stable machine codes.
- **Auditability.** Privileged mutations write audit rows with actor, target
  and before/after snapshots.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | `file:./dev.db` relative to `prisma/` for SQLite |
| `SESSION_PEPPER` | dev value | HMAC pepper for session tokens; **must** be strong in production |
| `APP_URL` | `http://localhost:3000` | Used for links and same-origin checks |
| `AUTH_AUTO_VERIFY_EMAIL` | `true` | Dev convenience; set `false` to exercise verification |
| `AUTH_DEV_EXPOSE_TOKENS` | `true` | Exposes verification/reset tokens in API responses — **only** for dev |
| `DEADLINE_GRACE_SECONDS` | `2` | Extra time before a write is rejected post-deadline |
| `SWEEPER_ENABLED` | `true` | Auto-finalise expired attempts on read paths |
| `SWEEP_TOKEN` | dev value | Bearer token for `POST /api/internal/sweep` |
| `SEED_DEMO_DATA` | `true` | Seed demo students and attempts |

## Testing

- Unit tests cover scoring (negative marking, partial credit, overrides),
  ranking (tie-break ordering, shared ranks, rank movement), paper generation
  (determinism, counts, no correctness leakage) and auth primitives (scrypt
  hashing, token hashing).
- The integration test (`tests/attempt-lifecycle.test.ts`) exercises the real
  attempt service against a dedicated SQLite database (`prisma/test.db`) that
  is rebuilt automatically before the run.
- The e2e script exercises the deployed HTTP surface end to end.

```bash
npm run typecheck && npm test && npm run build && npm run e2e
```

## Running in production (PostgreSQL)

1. Point `DATABASE_URL` at PostgreSQL and set `provider = "postgresql"` in
   `prisma/schema.prisma`. The schema deliberately avoids SQLite-only features,
   so no model changes are needed.
2. Apply schema with `npx prisma migrate deploy` (or `npx prisma migrate dev`
   to generate new migrations from scratch) and run the seed if you need
   reference data.
3. Set strong `SESSION_PEPPER` and `SWEEP_TOKEN` values, `APP_URL` to your
   public HTTPS origin, and turn `AUTH_DEV_EXPOSE_TOKENS` off.
4. `npm run build && npm start` behind a process manager; terminate TLS at a
   reverse proxy. Session cookies are `Secure` in production, so HTTPS is
   required.
5. Schedule the sweeper (e.g. every minute):
   `curl -X POST -H "Authorization: Bearer $SWEEP_TOKEN" $APP_URL/api/internal/sweep`

## Security model and known limitations

- Sessions are opaque random tokens; only their HMAC is stored. Cookies are
  `HttpOnly`, `SameSite=Lax`, `Secure` in production. State-changing endpoints
  additionally check same-origin (requests without an `Origin` header are
  allowed, which is the documented defense-in-depth trade-off; cookie
  `SameSite` is the primary CSRF control).
- Passwords use scrypt with per-user salts. Role checks are enforced
  server-side on every admin route, not just hidden in the UI.
- Rate limits are enforced in-memory per process. This is correct for a single
  instance; behind multiple instances, move them to a shared store (e.g.
  Redis). Limits include login, registration, attempt start, answer saves,
  event recording and submit.
- SQLite is a single-writer database — fine for development and small pilots,
  but use PostgreSQL for concurrent production load.
- Integrity signals (focus changes, concurrent sessions) are advisory evidence
  for staff review, never automatic disqualification.
- There is no email integration: verification and reset tokens are surfaced in
  API responses only when `AUTH_DEV_EXPOSE_TOKENS=true`, and plain-text mail is
  logged in development.
