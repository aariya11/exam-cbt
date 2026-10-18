import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/components/ui";
import { Badge, Card, CardHeader, LinkButton, Table, Td, Th, buttonClass } from "@/components/ui";
import { AlertActions } from "@/components/admin/alert-actions";

export const dynamic = "force-dynamic";

const TABS = ["OPEN", "RESOLVED", "DISMISSED", "ALL"] as const;
const SEVERITIES = ["", "HIGH", "MEDIUM", "LOW"];
const PAGE_SIZE = 25;

function severityTone(severity: string) {
  if (severity === "HIGH") return "danger" as const;
  if (severity === "MEDIUM") return "warn" as const;
  return "neutral" as const;
}

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = TABS.includes((params.status ?? "OPEN") as (typeof TABS)[number]) ? (params.status ?? "OPEN") : "OPEN";
  const severity = SEVERITIES.includes(params.severity ?? "") ? (params.severity as string) : "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(severity ? { severity } : {}),
  };

  const [total, alerts] = await Promise.all([
    prisma.integrityAlert.count({ where }),
    prisma.integrityAlert.findMany({
      where,
      include: {
        attempt: { select: { id: true, exam: { select: { title: true } } } },
        user: { select: { username: true } },
        reviewedBy: { select: { username: true } },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (status !== "OPEN") query.set("status", status);
    if (severity) query.set("severity", severity);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `/admin/alerts${text ? `?${text}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Integrity alerts</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {formatNumber(total)} alert(s). Every signal is reviewed by a human before any decision is taken.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/admin/alerts${tab === "OPEN" ? "" : `?status=${tab}`}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium",
              status === tab
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                : "border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800",
            )}
          >
            {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200 dark:bg-ink-700" aria-hidden />
        {["", "HIGH", "MEDIUM", "LOW"].map((level) => (
          <Link
            key={level || "all"}
            href={pageHref(1).replace(/\?.*$/, "") + `?status=${status}${level ? `&severity=${level}` : ""}`}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium",
              severity === level
                ? "border-ink-500 bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100"
                : "border-ink-200 text-ink-500 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800",
            )}
          >
            {level ? level.charAt(0) + level.slice(1).toLowerCase() : "All severities"}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Alert queue" description="Highest severity first" />
        {alerts.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500 dark:text-ink-400">
            Nothing here. {status === "OPEN" ? "No alerts are awaiting review." : "No alerts match the filters."}
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Signal</Th>
                <Th>Severity</Th>
                <Th>Candidate / exam</Th>
                <Th>Raised</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <Td>
                    <p className="font-medium text-ink-900 dark:text-ink-100">{alert.type.replaceAll("_", " ").toLowerCase()}</p>
                    {alert.detail ? <p className="max-w-sm truncate text-xs text-ink-500 dark:text-ink-400">{alert.detail}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={severityTone(alert.severity)}>{alert.severity.toLowerCase()}</Badge>
                    {typeof alert.confidence === "number" ? (
                      <p className="nums mt-0.5 text-xs text-ink-400">confidence {Math.round(alert.confidence * 100)}%</p>
                    ) : null}
                  </Td>
                  <Td className="text-xs">
                    @{alert.user?.username ?? "unknown"}
                    <p className="text-ink-500 dark:text-ink-400">{alert.attempt?.exam.title ?? "-"}</p>
                  </Td>
                  <Td className="nums text-xs">{formatDateTime(alert.createdAt)}</Td>
                  <Td>
                    <Badge tone={alert.status === "OPEN" ? "warn" : alert.status === "RESOLVED" ? "success" : "neutral"}>
                      {alert.status.toLowerCase()}
                    </Badge>
                    {alert.reviewedBy ? (
                      <p className="mt-0.5 text-xs text-ink-400">by {alert.reviewedBy.username}</p>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {alert.attemptId ? (
                        <LinkButton href={`/admin/attempts/${alert.attemptId}`} variant="ghost" size="sm">
                          View attempt
                        </LinkButton>
                      ) : null}
                      {alert.status === "OPEN" ? <AlertActions alertId={alert.id} alertType={alert.type} /> : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="nums text-xs text-ink-500 dark:text-ink-400">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonClass("secondary", "sm")}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonClass("secondary", "sm")}>
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
