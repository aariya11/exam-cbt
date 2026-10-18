import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/components/ui";
import { Badge, Card, CardHeader, Input, LinkButton, Select, Table, Td, Th, buttonClass, difficultyTone, statusTone } from "@/components/ui";
import { QuestionActions } from "@/components/admin/question-actions";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "RETIRED"] as const;
const PAGE_SIZE = 20;

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; difficulty?: string; subjectId?: string; search?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;

  const status = STATUSES.includes((params.status ?? "ALL") as (typeof STATUSES)[number]) ? (params.status ?? "ALL") : "ALL";
  const difficulty = ["EASY", "MEDIUM", "HARD"].includes(params.difficulty ?? "") ? (params.difficulty as string) : "";
  const subjectId = params.subjectId ?? "";
  const search = (params.search ?? "").trim();
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(status !== "ALL" ? { status } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(search ? { text: { contains: search } } : {}),
  };

  const [total, questions, subjects] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { subject: true, topic: true, createdBy: { select: { username: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isAdmin = isAtLeastRole(user.role, ROLES.ADMIN);

  const buildQuery = (overrides: Record<string, string>) => {
    const query = new URLSearchParams();
    const base: Record<string, string> = {
      ...(status !== "ALL" ? { status } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(search ? { search } : {}),
    };
    for (const [key, value] of Object.entries({ ...base, ...overrides })) {
      if (value) query.set(key, value);
    }
    const asString = query.toString();
    return `/admin/questions${asString ? `?${asString}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-950 dark:text-ink-50">Question bank</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {formatNumber(total)} question(s) match the current filters. Published questions are immutable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/questions/import" variant="secondary">
            Import CSV
          </LinkButton>
          <LinkButton href="/admin/questions/new">New question</LinkButton>
        </div>
      </div>

      <form method="GET" action="/admin/questions" className="grid gap-2 sm:grid-cols-[1fr_170px_170px_auto]">
        <Input name="search" defaultValue={search} placeholder="Search question text…" />
        <Select name="subjectId" defaultValue={subjectId}>
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </Select>
        <Select name="difficulty" defaultValue={difficulty}>
          <option value="">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </Select>
        <div className="flex gap-2">
          <input type="hidden" name="status" value={status === "ALL" ? "" : status} />
          <button type="submit" className={buttonClass("secondary", "md")}>
            Filter
          </button>
          <Link href="/admin/questions" className={buttonClass("ghost", "md")}>
            Reset
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((tab) => (
          <Link
            key={tab}
            href={buildQuery(tab === "ALL" ? { status: "" } : { status: tab })}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium",
              status === tab
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                : "border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800",
            )}
          >
            {tab === "ALL" ? "All" : tab.replaceAll("_", " ").toLowerCase()}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="Questions" description="Review workflow: draft → in review → approved → published → retired" />
        {questions.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500 dark:text-ink-400">No questions match these filters.</div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Subject</Th>
                <Th>Difficulty</Th>
                <Th>Status</Th>
                <Th className="text-right">Ver.</Th>
                <Th>Updated</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <Td className="max-w-sm">
                    <Link
                      href={`/admin/questions/${question.id}`}
                      className="block truncate font-medium text-ink-900 hover:text-brand-600 dark:text-ink-100 dark:hover:text-brand-300"
                    >
                      {question.text}
                    </Link>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {question.topic ? `${question.topic.name} · ` : ""}by {question.createdBy.username}
                    </p>
                  </Td>
                  <Td className="text-xs">{question.subject.name}</Td>
                  <Td>
                    <Badge tone={difficultyTone(question.difficulty)}>{question.difficulty.toLowerCase()}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(question.status)}>{question.status.replaceAll("_", " ").toLowerCase()}</Badge>
                  </Td>
                  <Td className="nums text-right text-xs">{question.version}</Td>
                  <Td className="text-xs">{formatDateTime(question.updatedAt)}</Td>
                  <Td className="text-right">
                    <QuestionActions questionId={question.id} status={question.status} isAdmin={isAdmin} />
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
              <Link href={`${buildQuery({ page: String(page - 1) })}`} className={buttonClass("secondary", "sm")}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={`${buildQuery({ page: String(page + 1) })}`} className={buttonClass("secondary", "sm")}>
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
