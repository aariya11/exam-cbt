import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, Card, CardHeader, Input, Table, Td, Th, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const ENTITY_TYPES = ["", "Exam", "Question", "User", "IntegrityAlert", "Attempt", "SystemSetting", "Result"];

function formatJson(value: string | null): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 1);
  } catch {
    return value;
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; action?: string; page?: string }>;
}) {
  const params = await searchParams;
  const entityType = ENTITY_TYPES.includes(params.entityType ?? "") ? (params.entityType as string) : "";
  const action = (params.action ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action: { contains: action } } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { username: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (entityType) query.set("entityType", entityType);
    if (action) query.set("action", action);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `/admin/audit${text ? `?${text}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Audit log</h1>
        <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
          {formatNumber(total)} recorded action(s). Entries are append-only and never edited.
        </p>
      </div>

      <form method="GET" action="/admin/audit" className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
        <select
          name="entityType"
          defaultValue={entityType}
          className="block h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 shadow-sm dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-100"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.filter(Boolean).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <Input name="action" defaultValue={action} placeholder="Filter by action, e.g. exam.activated" />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("secondary", "md")}>
            Filter
          </button>
          <Link href="/admin/audit" className={buttonClass("ghost", "md")}>
            Reset
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader title="Recorded actions" description="Newest first" />
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500 dark:text-ink-400">No audit entries match the filters.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Changes</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const before = formatJson(log.before);
                const after = formatJson(log.after);
                return (
                  <tr key={log.id}>
                    <Td className="nums whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</Td>
                    <Td className="text-xs">
                      {log.actor ? (
                        <>
                          {log.actor.username}
                          <p className="text-ink-400">{log.actor.role.replaceAll("_", " ").toLowerCase()}</p>
                        </>
                      ) : (
                        <span className="text-ink-400">system</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone="brand">{log.action}</Badge>
                    </Td>
                    <Td className="text-xs">
                      {log.entityType}
                      {log.entityId ? <p className="text-ink-400">{log.entityId.slice(0, 12)}…</p> : null}
                    </Td>
                    <Td className="max-w-md text-xs">
                      {before || after ? (
                        <details>
                          <summary className="cursor-pointer text-brand-600 dark:text-brand-300">View</summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-ink-50 p-2 text-[11px] leading-4 text-ink-600 dark:bg-ink-900 dark:text-ink-300">
                            {before ? `before: ${before}` : ""}
                            {before && after ? "\n" : ""}
                            {after ? `after: ${after}` : ""}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
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
