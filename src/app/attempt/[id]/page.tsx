import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { loadAttemptForStudent } from "@/lib/attempt-service";
import { buildAttemptStateView } from "@/lib/attempt-view";
import { AppError } from "@/lib/errors";
import { ExamRunner } from "@/components/exam/exam-runner";
import { Card, CardBody } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mock test in progress",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function AttemptPage({ params }: { params: Params }) {
  const { id } = await params;
  const auth = await getAuthContext();
  if (!auth) redirect(`/login?next=${encodeURIComponent(`/attempt/${id}`)}`);

  let loaded;
  try {
    loaded = await loadAttemptForStudent(id, auth.user.id, auth.sessionId, { forWrite: false });
  } catch (error) {
    if (error instanceof AppError && error.code === "CONCURRENT_SESSION") {
      return (
        <div className="mx-auto max-w-lg px-4 py-16">
          <Card>
            <CardBody className="space-y-4 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-warn-500" aria-hidden />
              <h1 className="text-lg font-semibold text-ink-950 dark:text-ink-50">Attempt active in another session</h1>
              <p className="text-sm leading-6 text-ink-500 dark:text-ink-400">{error.message}</p>
              <p className="text-xs leading-5 text-ink-400 dark:text-ink-500">
                Your timer keeps running. Sign out of the other device or close that tab, then retry.
              </p>
              <a
                href={`/attempt/${id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Try again
              </a>
            </CardBody>
          </Card>
        </div>
      );
    }
    notFound();
  }

  const { attempt, exam } = loaded;

  if (attempt.status !== "IN_PROGRESS") {
    redirect(`/attempt/${attempt.id}/result`);
  }

  // One more integrity guard: never serve the runner for a paper with no questions.
  const questionCount = await prisma.examQuestion.count({ where: { examId: exam.id, isDefective: false } });
  if (questionCount === 0) notFound();

  const view = await buildAttemptStateView(attempt, exam);
  return <ExamRunner view={view} />;
}
