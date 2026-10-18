import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, Stat, statusTone } from "@/components/ui";
import { AlertTriangle, BookOpen, FileText, ShieldAlert, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isManager = isAtLeastRole(user.role, ROLES.EXAM_MANAGER);
  const isAdmin = isAtLeastRole(user.role, ROLES.ADMIN);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [questionTotal, questionsByStatus, publishedQuestions] = await Promise.all([
    prisma.question.count(),
    prisma.question.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.question.count({ where: { status: "PUBLISHED" } }),
  ]);

  const examStats = isManager
    ? await Promise.all([
        prisma.exam.count({ where: { status: "ACTIVE" } }),
        prisma.exam.count(),
        prisma.attempt.count({ where: { startedAt: { gte: dayStart } } }),
        prisma.attempt.count({ where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } } }),
      ])
    : null;

  const openAlerts = isManager
    ? await prisma.integrityAlert.findMany({
        where: { status: "OPEN" },
        include: { attempt: { select: { exam: { select: { title: true } } } }, user: { select: { username: true } } },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 5,
      })
    : [];
  const openAlertCount = isManager ? await prisma.integrityAlert.count({ where: { status: "OPEN" } }) : null;

  const userCount = isAdmin ? await prisma.user.count() : null;
  const recentAudit = isAdmin
    ? await prisma.auditLog.findMany({
        include: { actor: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  const statusMap = new Map(questionsByStatus.map((row) => [row.status, row._count._all]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Operations overview</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          Signed in as {user.displayName} ({user.role.replaceAll("_", " ").toLowerCase()}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Questions" value={formatNumber(questionTotal)} hint={`${formatNumber(publishedQuestions)} published`} icon={<FileText className="h-4 w-4" />} />
        {examStats ? (
          <>
            <Stat label="Active exams" value={formatNumber(examStats[0])} hint={`${formatNumber(examStats[1])} total`} icon={<BookOpen className="h-4 w-4" />} />
            <Stat label="Attempts today" value={formatNumber(examStats[2])} hint={`${formatNumber(examStats[3])} submitted all-time`} />
          </>
        ) : null}
        {isManager ? (
          <Stat
            label="Open alerts"
            value={formatNumber(openAlertCount ?? 0)}
            hint="Awaiting review"
            icon={<ShieldAlert className="h-4 w-4" />}
          />
        ) : null}
        {isAdmin ? <Stat label="Users" value={formatNumber(userCount ?? 0)} hint="Registered accounts" icon={<Users className="h-4 w-4" />} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Question bank by status"
            description="Review workflow positions"
            action={
              <Link href="/admin/questions" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                Open question bank
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "RETIRED"].map((status) => (
              <div key={status} className="flex items-center justify-between gap-3">
                <Badge tone={statusTone(status)}>{status.replaceAll("_", " ")}</Badge>
                <span className="nums text-sm text-ink-700 dark:text-ink-200">{formatNumber(statusMap.get(status) ?? 0)}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        {isManager ? (
          <Card>
            <CardHeader
              title="Open integrity alerts"
              description="Highest severity first"
              action={
                <Link href="/admin/alerts" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                  Review all
                </Link>
              }
            />
            <CardBody>
              {openAlerts.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">No open alerts. Nothing needs attention.</p>
              ) : (
                <ul className="space-y-3">
                  {openAlerts.map((alert) => (
                    <li key={alert.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900 dark:text-ink-100">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn-500" aria-hidden />
                          <span className="truncate">{alert.type.replaceAll("_", " ").toLowerCase()}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">
                          {alert.attempt?.exam.title ?? "Unknown exam"} · {alert.user?.username ?? "unknown user"}
                        </p>
                      </div>
                      <Badge tone={alert.severity === "HIGH" ? "danger" : alert.severity === "MEDIUM" ? "warn" : "neutral"}>
                        {alert.severity.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}

        {isAdmin ? (
          <Card className={isManager ? "lg:col-span-2" : ""}>
            <CardHeader
              title="Recent administrative activity"
              description="Every staff action is recorded"
              action={
                <Link href="/admin/audit" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                  Open audit log
                </Link>
              }
            />
            <CardBody>
              {recentAudit.length === 0 ? (
                <p className="text-sm text-ink-500 dark:text-ink-400">No audit entries yet.</p>
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {recentAudit.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink-800 dark:text-ink-100">{log.action}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">
                          {log.actor?.username ?? "system"} · {log.entityType}
                          {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}
                        </p>
                      </div>
                      <span className="nums shrink-0 text-xs text-ink-400 dark:text-ink-500">{formatDateTime(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
