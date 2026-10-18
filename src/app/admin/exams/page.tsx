import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, Card, CardHeader, LinkButton, Table, Td, Th, statusTone, buttonClass } from "@/components/ui";
import { cn } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS = ["ALL", "DRAFT", "SCHEDULED", "ACTIVE", "ARCHIVED"] as const;
const PAGE_SIZE = 20;

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = TABS.includes((params.status ?? "ALL") as (typeof TABS)[number]) ? (params.status ?? "ALL") : "ALL";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = status === "ALL" ? {} : { status };
  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: {
        category: true,
        sections: true,
        _count: { select: { attempts: true, questions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Examinations</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {formatNumber(total)} examination(s). Drafts are invisible to candidates.
          </p>
        </div>
        <LinkButton href="/admin/exams/new">New examination</LinkButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/admin/exams${tab === "ALL" ? "" : `?status=${tab}`}`}
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
      </div>

      <Card>
        <CardHeader title="Examination list" description="Manage sections, question pool and lifecycle" />
        {exams.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500 dark:text-ink-400">
            No examinations in this view. Create one to get started.
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Examination</Th>
                <Th>Status</Th>
                <Th>Category</Th>
                <Th className="text-right">Duration</Th>
                <Th className="text-right">Sections</Th>
                <Th className="text-right">Pool</Th>
                <Th className="text-right">Attempts</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <Td>
                    <Link href={`/admin/exams/${exam.id}`} className="font-medium text-ink-900 hover:text-brand-600 dark:text-ink-100 dark:hover:text-brand-300">
                      {exam.title}
                    </Link>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      /{exam.slug}
                      {exam.opensAt ? ` · opens ${formatDateTime(exam.opensAt)}` : ""}
                      {exam.closesAt ? ` · closes ${formatDateTime(exam.closesAt)}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(exam.status)}>{exam.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-xs">{exam.category.name}</Td>
                  <Td className="nums text-right text-xs">{exam.durationMinutes} min</Td>
                  <Td className="nums text-right text-xs">{exam.sections.length}</Td>
                  <Td className="nums text-right text-xs">{exam._count.questions}</Td>
                  <Td className="nums text-right text-xs">{exam._count.attempts}</Td>
                  <Td className="text-right">
                    <Link href={`/admin/exams/${exam.id}`} className={buttonClass("secondary", "sm")}>
                      Manage
                    </Link>
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
              <Link href={`/admin/exams?${status !== "ALL" ? `status=${status}&` : ""}page=${page - 1}`} className={buttonClass("secondary", "sm")}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={`/admin/exams?${status !== "ALL" ? `status=${status}&` : ""}page=${page + 1}`} className={buttonClass("secondary", "sm")}>
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
