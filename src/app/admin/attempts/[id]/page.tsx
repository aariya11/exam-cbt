import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES } from "@/lib/constants";
import { formatDateTime, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, Stat, statusTone } from "@/components/ui";
import { AttemptActions } from "@/components/admin/attempt-actions";

export const dynamic = "force-dynamic";

export default async function AdminAttemptReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, title: true } },
      user: { select: { id: true, username: true, displayName: true, email: true } },
      result: true,
      events: { orderBy: { serverTime: "asc" }, take: 500 },
      integrityAlerts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!attempt) notFound();

  const isAdmin = isAtLeastRole(user.role, ROLES.ADMIN);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">
              Attempt review
            </h1>
            <Badge tone={statusTone(attempt.status)}>{attempt.status.replaceAll("_", " ").toLowerCase()}</Badge>
            {attempt.finalizeReason ? <Badge tone="neutral">{attempt.finalizeReason.replaceAll("_", " ").toLowerCase()}</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {attempt.user.displayName} (@{attempt.user.username}) ·{" "}
            <Link href={`/admin/exams/${attempt.exam.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-300">
              {attempt.exam.title}
            </Link>
          </p>
        </div>
        {isAdmin ? (
          <AttemptActions attemptId={attempt.id} status={attempt.status} hasSession={Boolean(attempt.sessionId)} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Started" value={formatDateTime(attempt.startedAt)} hint={`Deadline ${formatDateTime(attempt.deadlineAt)}`} />
        <Stat
          label="Submitted"
          value={attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
          hint={attempt.result ? `${formatDuration(attempt.result.timeUsedSec)} used` : "Still in progress"}
        />
        <Stat
          label="Focus warnings"
          value={formatNumber(attempt.focusWarnings)}
          hint="Visibility, blur and full-screen exits"
        />
        <Stat
          label="Result"
          value={attempt.result ? formatPercent(attempt.result.percentage) : "—"}
          hint={
            attempt.result
              ? `Score ${formatNumber(attempt.result.score)} of ${formatNumber(attempt.result.maxScore)} · ${attempt.result.publishedAt ? "published" : "unpublished"}`
              : "Awaiting finalisation"
          }
        />
      </div>

      {attempt.invalidatedReason ? (
        <div className="rounded-xl border border-danger-500/30 bg-danger-50 p-4 text-sm text-danger-600 dark:bg-danger-500/10 dark:text-danger-500">
          <p className="font-medium">Invalidated</p>
          <p className="mt-1 text-xs">{attempt.invalidatedReason}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Integrity alerts raised on this attempt" description="Human review only — no automatic penalties" />
        <CardBody>
          {attempt.integrityAlerts.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No alerts were raised for this attempt.</p>
          ) : (
            <ul className="space-y-2">
              {attempt.integrityAlerts.map((alert) => (
                <li key={alert.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 dark:border-ink-800">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {alert.type.replaceAll("_", " ").toLowerCase()}
                    </p>
                    {alert.detail ? <p className="text-xs text-ink-500 dark:text-ink-400">{alert.detail}</p> : null}
                    <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(alert.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={alert.severity === "HIGH" ? "danger" : alert.severity === "MEDIUM" ? "warn" : "neutral"}>
                      {alert.severity.toLowerCase()}
                    </Badge>
                    <p className="mt-0.5 text-xs text-ink-400">{alert.status.toLowerCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Event timeline (${attempt.events.length})`}
          description="Server-recorded events with client-reported times for comparison"
        />
        <CardBody>
          {attempt.events.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No events recorded.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-ink-200 pl-5 dark:border-ink-700">
              {attempt.events.map((event, index) => (
                <li key={index} className="relative">
                  <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-400 dark:border-ink-900" aria-hidden />
                  <p className="text-sm text-ink-800 dark:text-ink-100">
                    <span className="font-medium">{event.type.replaceAll("_", " ").toLowerCase()}</span>
                    <span className="nums ml-2 text-xs text-ink-400">{formatDateTime(event.serverTime)}</span>
                    {event.clientTime ? (
                      <span className="nums ml-2 text-xs text-ink-400">
                        (client {formatDateTime(event.clientTime)})
                      </span>
                    ) : null}
                  </p>
                  {event.detail ? <p className="mt-0.5 break-words text-xs text-ink-500 dark:text-ink-400">{event.detail}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-ink-500 dark:text-ink-400">
        <Link href="/admin/alerts" className="font-medium text-brand-600 hover:underline dark:text-brand-300">
          Back to the alert queue
        </Link>
      </p>
    </div>
  );
}
