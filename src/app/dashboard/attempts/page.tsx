import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-context";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Table, Td, Th, statusTone } from "@/components/ui";
import { PAGE_SIZE_DEFAULT } from "@/lib/constants";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { FileClock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My attempts",
};

type SearchParams = Promise<{ page?: string }>;

export default async function AttemptsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [attempts, total] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE_DEFAULT,
      take: PAGE_SIZE_DEFAULT,
      include: {
        exam: { select: { title: true, slug: true, difficulty: true } },
        result: { select: { score: true, maxScore: true, percentage: true, accuracy: true, timeUsedSec: true, rankSnapshot: true, publishedAt: true } },
      },
    }),
    prisma.attempt.count({ where: { userId: user.id } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE_DEFAULT));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 dark:text-ink-50">My attempts</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Every attempt you have started, in reverse chronological order. In-progress attempts can be resumed; the
          deadline keeps running even if you close this page.
        </p>
      </header>

      <Card>
        <CardHeader title={`${total} attempt${total === 1 ? "" : "s"}`} description={`Page ${page} of ${pages}`} />
        {attempts.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<FileClock className="h-8 w-8" aria-hidden />}
              title="No attempts yet"
              description="Your mock test history will appear here with scores, ranks and status."
              action={<LinkButton href="/mock-tests" size="sm">Find a mock test</LinkButton>}
            />
          </CardBody>
        ) : (
          <CardBody className="px-0 py-0">
            <Table className="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Test</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right">Accuracy</Th>
                  <Th className="text-right">Time used</Th>
                  <Th>Started</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <Td>
                      <span className="block max-w-56 truncate font-medium text-ink-900 dark:text-ink-100">
                        {attempt.exam.title}
                      </span>
                      <span className="text-xs text-ink-400">{attempt.exam.difficulty}</span>
                    </Td>
                    <Td>
                      <Badge tone={statusTone(attempt.status)}>{attempt.status.replace("_", " ").toLowerCase()}</Badge>
                      {attempt.invalidatedReason ? (
                        <span className="mt-1 block max-w-44 text-[11px] leading-4 text-ink-400">{attempt.invalidatedReason}</span>
                      ) : null}
                    </Td>
                    <Td className="nums text-right">
                      {attempt.result ? (
                        <>
                          {attempt.result.score} / {attempt.result.maxScore}
                          <span className="ml-1.5 text-xs text-ink-400">({formatPercent(attempt.result.percentage)})</span>
                        </>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="nums text-right">{attempt.result ? formatPercent(attempt.result.accuracy) : "-"}</Td>
                    <Td className="nums text-right text-xs">
                      {attempt.result ? formatDuration(attempt.result.timeUsedSec) : formatDuration((Date.now() - attempt.startedAt.getTime()) / 1000)}
                    </Td>
                    <Td className="nums text-xs">{formatDateTime(attempt.startedAt)}</Td>
                    <Td className="text-right">
                      {attempt.status === "IN_PROGRESS" ? (
                        <Link href={`/attempt/${attempt.id}`} className="text-xs font-medium text-warn-600 hover:underline">
                          Resume
                        </Link>
                      ) : attempt.result ? (
                        <Link
                          href={`/attempt/${attempt.id}/result`}
                          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                        >
                          Scorecard
                        </Link>
                      ) : (
                        <Link href={`/mock-tests/${attempt.exam.slug}`} className="text-xs font-medium text-ink-500 hover:underline">
                          Details
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between gap-3 px-5 pb-4">
              <p className="nums text-xs text-ink-500 dark:text-ink-400">
                Page {page} of {pages} · {total} attempt(s)
              </p>
              <div className="flex gap-3">
                {page > 1 ? (
                  <Link className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300" href={`/dashboard/attempts?page=${page - 1}`}>
                    ← Previous
                  </Link>
                ) : null}
                {page < pages ? (
                  <Link className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300" href={`/dashboard/attempts?page=${page + 1}`}>
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
