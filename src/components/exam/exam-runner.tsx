"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, CardBody, Modal, cn } from "@/components/ui";
import { MathText } from "@/components/math-text";
import { PaletteLegend, QuestionPalette } from "./question-palette";
import type { AttemptAnswerState, AttemptStateView, RunnerQuestion } from "@/lib/attempt-view";
import { formatClock } from "@/lib/format";
import {
  AlertTriangle,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Flag,
  Maximize2,
  Minimize2,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";

type SaveStatus = "idle" | "saving" | "saved" | "pending";

type PendingWrite = {
  selectedOptionIds: string[];
  markedForReview: boolean;
  visited: boolean;
};

type ApiErrorBody = { error?: { code?: string; message?: string } };

const FOCUS_EVENT_TYPES = new Set(["visibility_hidden", "window_blur", "fullscreen_exit"]);

export function ExamRunner({ view }: { view: AttemptStateView }) {
  const router = useRouter();
  const attemptId = view.attempt.id;

  const [answers, setAnswers] = useState<Record<string, AttemptAnswerState>>(() => ({ ...view.answers }));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const serverOffsetRef = useRef(0);
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((new Date(view.attempt.deadlineAt).getTime() - Date.now() + serverOffsetRef.current) / 1000)),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [offline, setOffline] = useState(false);
  const [focusWarnings, setFocusWarnings] = useState(view.attempt.focusWarnings);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [exiting, setExiting] = useState<string | null>(null);

  const pendingRef = useRef<Map<string, PendingWrite>>(new Map());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventAt = useRef(0);
  const finishedRef = useRef(false);
  const submitRef = useRef<(auto: boolean) => Promise<void>>(async () => {});

  const questions = view.questions;
  const current = questions[currentIndex];
  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const question of questions) {
      if (question.sectionId && !map.has(question.sectionId)) map.set(question.sectionId, question.sectionTitle || "Section");
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }));
  }, [questions]);

  /* ------------------------------ server clock ----------------------------- */

  const applyServerTime = useCallback((serverTime: string) => {
    const parsed = new Date(serverTime).getTime();
    if (Number.isFinite(parsed)) serverOffsetRef.current = parsed - Date.now();
  }, []);

  useEffect(() => {
    applyServerTime(view.serverTime);
  }, [view.serverTime, applyServerTime]);

  useEffect(() => {
    const tick = () => {
      const deadline = new Date(view.attempt.deadlineAt).getTime();
      const left = Math.max(0, Math.floor((deadline - (Date.now() + serverOffsetRef.current)) / 1000));
      setRemainingSec(left);
      // Last-chance saves just before the deadline (the server allows a small grace).
      if ((left === 5 || left === 3 || left === 1) && pendingRef.current.size > 0) {
        void flushPending();
      }
      if (left === 0 && !finishedRef.current) {
        void submitRef.current(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.attempt.deadlineAt]);

  /* ------------------------------- saving -------------------------------- */

  const handleApiFailure = useCallback(
    (code: string | undefined, message: string | undefined, forSubmit: boolean) => {
      if (code === "CONCURRENT_SESSION") {
        setBlocked(message ?? "This attempt is active in another session.");
        return;
      }
      if (code === "ATTEMPT_EXPIRED" || code === "ALREADY_FINALIZED" || code === "ATTEMPT_NOT_FINALIZABLE") {
        // The attempt was finalized (deadline or elsewhere); go to the result.
        finishedRef.current = true;
        setExiting(message ?? "Your attempt has been submitted.");
        void goToResult();
        return;
      }
      if (!forSubmit) {
        setOffline(true);
        setSaveStatus("pending");
        if (!retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            void flushPending();
          }, 3000);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const goToResult = useCallback(async () => {
    try {
      const response = await fetch(`/api/attempts/${attemptId}`, { cache: "no-store" });
      if (response.ok) {
        const fresh = (await response.json()) as AttemptStateView;
        if (fresh.attempt.status !== "IN_PROGRESS") {
          setTimeout(() => {
            router.push(`/attempt/${attemptId}/result`);
            router.refresh();
          }, 800);
          return;
        }
      }
    } catch {
      // fall through to a plain navigation attempt
    }
    setTimeout(() => {
      router.push(`/attempt/${attemptId}/result`);
      router.refresh();
    }, 800);
  }, [attemptId, router]);

  const flushPending = useCallback(async () => {
    if (finishedRef.current) return;
    const entries = [...pendingRef.current.entries()];
    if (entries.length === 0) {
      setSaveStatus((status) => (status === "saving" ? "saved" : status));
      return;
    }
    setSaveStatus("saving");
    let failures = 0;
    for (const [questionId, write] of entries) {
      try {
        const response = await fetch(`/api/attempts/${attemptId}/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            selectedOptionIds: write.selectedOptionIds,
            markedForReview: write.markedForReview,
            visited: write.visited,
          }),
        });
        if (response.ok) {
          const body = (await response.json()) as { serverTime?: string };
          if (body.serverTime) applyServerTime(body.serverTime);
          // Only clear the entry if it has not been rewritten while in flight.
          const latest = pendingRef.current.get(questionId);
          if (latest === write) pendingRef.current.delete(questionId);
          setOffline(false);
        } else {
          const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
          if (body.error?.code === "CONCURRENT_SESSION" || body.error?.code === "ATTEMPT_EXPIRED" || body.error?.code === "ALREADY_FINALIZED") {
            handleApiFailure(body.error.code, body.error.message, false);
            return;
          }
          failures += 1;
        }
      } catch {
        failures += 1;
      }
    }
    if (failures > 0) {
      setOffline(true);
      setSaveStatus("pending");
      if (!retryTimer.current) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          void flushPending();
        }, 3000);
      }
      return;
    }
    setSaveStatus(pendingRef.current.size > 0 ? "pending" : "saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, applyServerTime, handleApiFailure]);

  const queueWrite = useCallback(
    (questionId: string, patch: Partial<PendingWrite>) => {
      const existing = pendingRef.current.get(questionId);
      const base: PendingWrite = existing ?? {
        selectedOptionIds: answersRef.current[questionId]?.selectedOptionIds ?? [],
        markedForReview: answersRef.current[questionId]?.markedForReview ?? false,
        visited: answersRef.current[questionId]?.visited ?? false,
      };
      pendingRef.current.set(questionId, { ...base, ...patch });
      setSaveStatus("pending");
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flushPending();
      }, 500);
    },
    [flushPending],
  );

  const setLocalAnswer = useCallback((questionId: string, patch: Partial<AttemptAnswerState>) => {
    setAnswers((currentAnswers) => {
      const base = currentAnswers[questionId] ?? { selectedOptionIds: [], markedForReview: false, visited: false };
      return { ...currentAnswers, [questionId]: { ...base, ...patch } };
    });
  }, []);

  /* ------------------------------- events -------------------------------- */

  const logEvent = useCallback(
    (type: string, detail?: Record<string, unknown>) => {
      if (finishedRef.current) return;
      const now = Date.now();
      if (now - lastEventAt.current < 1000 && !FOCUS_EVENT_TYPES.has(type)) return;
      lastEventAt.current = now;
      void fetch(`/api/attempts/${attemptId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, detail: detail ?? {}, clientTime: new Date().toISOString() }),
        keepalive: true,
      })
        .then(async (response) => {
          if (response.ok) {
            const body = (await response.json()) as { focusWarnings?: number };
            if (typeof body.focusWarnings === "number") setFocusWarnings(body.focusWarnings);
          }
        })
        .catch(() => undefined);
    },
    [attemptId],
  );

  useEffect(() => {
    const onVisibility = () => {
      logEvent(document.visibilityState === "hidden" ? "visibility_hidden" : "visibility_visible");
      if (document.visibilityState === "hidden") void flushPending();
    };
    const onBlur = () => logEvent("window_blur");
    const onFocus = () => logEvent("window_focus");
    const onFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      logEvent(active ? "fullscreen_enter" : "fullscreen_exit");
    };
    const onPageHide = () => {
      for (const [questionId, write] of pendingRef.current.entries()) {
        void fetch(`/api/attempts/${attemptId}/answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, ...write }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [attemptId, logEvent, flushPending]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      void flushPending();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushPending]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (finishedRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Periodic reconciliation with the server (missed writes, status changes).
  useEffect(() => {
    const interval = setInterval(async () => {
      if (finishedRef.current) return;
      try {
        const response = await fetch(`/api/attempts/${attemptId}`, { cache: "no-store" });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
          if (body.error?.code === "CONCURRENT_SESSION") setBlocked(body.error.message ?? "Active in another session.");
          return;
        }
        const fresh = (await response.json()) as AttemptStateView;
        applyServerTime(fresh.serverTime);
        setFocusWarnings(fresh.attempt.focusWarnings);
        if (fresh.attempt.status !== "IN_PROGRESS") {
          finishedRef.current = true;
          setExiting("Your attempt has been submitted.");
          void goToResult();
          return;
        }
        setAnswers((currentAnswers) => {
          const merged = { ...currentAnswers };
          for (const [questionId, state] of Object.entries(fresh.answers)) {
            if (!pendingRef.current.has(questionId)) merged[questionId] = state;
          }
          return merged;
        });
        setOffline(false);
      } catch {
        setOffline(true);
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [attemptId, applyServerTime, goToResult]);

  /* ------------------------------- actions -------------------------------- */

  const goToQuestion = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, index));
      setCurrentIndex(clamped);
      const question = questions[clamped];
      if (question && sectionFilter && question.sectionId !== sectionFilter) {
        setSectionFilter(question.sectionId);
      }
      if (question) {
        const existing = answersRef.current[question.questionId];
        if (!existing?.visited) {
          setLocalAnswer(question.questionId, { visited: true });
          queueWrite(question.questionId, { visited: true });
        }
      }
    },
    [questions, sectionFilter, setLocalAnswer, queueWrite],
  );

  const selectOption = (question: RunnerQuestion, optionId: string) => {
    const existing = answersRef.current[question.questionId]?.selectedOptionIds ?? [];
    let next: string[];
    if (question.type === "MULTIPLE_CHOICE") {
      next = existing.includes(optionId) ? existing.filter((id) => id !== optionId) : [...existing, optionId];
    } else {
      next = [optionId];
    }
    setLocalAnswer(question.questionId, { selectedOptionIds: next, visited: true });
    queueWrite(question.questionId, { selectedOptionIds: next, visited: true });
  };

  const clearResponse = (question: RunnerQuestion) => {
    setLocalAnswer(question.questionId, { selectedOptionIds: [], visited: true });
    queueWrite(question.questionId, { selectedOptionIds: [], visited: true });
  };

  const toggleMark = (question: RunnerQuestion, forceValue?: boolean) => {
    const existing = answersRef.current[question.questionId]?.markedForReview ?? false;
    const next = forceValue ?? !existing;
    setLocalAnswer(question.questionId, { markedForReview: next, visited: true });
    queueWrite(question.questionId, { markedForReview: next, visited: true });
  };

  const submit = useCallback(
    async (auto: boolean) => {
      if (submitting || finishedRef.current) return;
      if (!auto) setSubmitOpen(true);
      setSubmitting(true);
      setSubmitError(null);
      if (!auto) await flushPending();
      try {
        const response = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
        const body = (await response.json()) as {
          resultId?: string | null;
          alreadyFinalized?: boolean;
          status?: string;
          error?: { code: string; message: string };
        };
        if (!response.ok) {
          if (body.error?.code === "CONCURRENT_SESSION") {
            setBlocked(body.error.message ?? "This attempt is active in another session.");
            setSubmitting(false);
            return;
          }
          setSubmitError(body.error?.message ?? "We could not submit your attempt. Please try again.");
          setSubmitting(false);
          return;
        }
        finishedRef.current = true;
        setExiting(
          body.status === "AUTO_SUBMITTED"
            ? "Time is up - your attempt was submitted automatically."
            : "Your attempt has been submitted.",
        );
        router.push(`/attempt/${attemptId}/result`);
        router.refresh();
      } catch {
        setSubmitError(
          "Network problem while submitting. Your answers are saved on the server - press Submit again when your connection returns.",
        );
        setOffline(true);
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attemptId, submitting, flushPending, router],
  );

  submitRef.current = submit;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // fullscreen may be blocked by the browser; not fatal
    }
  };

  /* ----------------------------- derived data ----------------------------- */

  const answeredCount = questions.filter((question) => (answers[question.questionId]?.selectedOptionIds.length ?? 0) > 0).length;
  const markedCount = questions.filter((question) => answers[question.questionId]?.markedForReview).length;
  const unansweredCount = questions.length - answeredCount;
  const lowTime = remainingSec <= 300;
  const criticalTime = remainingSec <= 60;
  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "pending"
        ? offline
          ? "Offline - will save"
          : "Unsaved changes"
        : saveStatus === "saved"
          ? "All answers saved"
          : "Autosave on";

  /* -------------------------------- render -------------------------------- */

  if (blocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card>
          <CardBody className="space-y-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-warn-500" aria-hidden />
            <h1 className="text-lg font-semibold text-ink-950 dark:text-ink-50">Attempt active in another session</h1>
            <p className="text-sm leading-6 text-ink-500 dark:text-ink-400">{blocked}</p>
            <p className="text-xs leading-5 text-ink-400 dark:text-ink-500">
              Your timer is still running. Sign out of the other device or close that tab, then retry. If the other
              device is gone, contact support and an administrator can release the session without invalidating your
              attempt.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard/attempts")}>
                Back to my attempts
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-100/60 dark:bg-ink-950">
      {exiting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4" role="alert">
          <Card className="max-w-md">
            <CardBody className="space-y-2 text-center">
              <h1 className="text-base font-semibold text-ink-950 dark:text-ink-50">{exiting}</h1>
              <p className="text-sm text-ink-500 dark:text-ink-400">Opening your scorecard…</p>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-ink-950 dark:text-ink-50">{view.exam.title}</h1>
            <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
              <span className="nums">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                {offline ? <WifiOff className="h-3 w-3 text-danger-500" aria-hidden /> : <Wifi className="h-3 w-3" aria-hidden />}
                {saveLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {view.exam.maxFocusWarnings > 0 ? (
              <Badge tone={focusWarnings >= view.exam.maxFocusWarnings ? "danger" : focusWarnings > 0 ? "warn" : "neutral"}>
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Focus warnings {focusWarnings}
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 sm:inline-flex dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            </button>
            <div
              role="timer"
              aria-live={criticalTime ? "assertive" : "off"}
              className={cn(
                "nums rounded-lg border px-3 py-1.5 text-base font-semibold tabular-nums",
                criticalTime
                  ? "animate-pulse border-danger-500 bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-500"
                  : lowTime
                    ? "border-warn-500 bg-warn-50 text-warn-600 dark:bg-warn-500/10 dark:text-warn-500"
                    : "border-ink-200 bg-white text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50",
              )}
            >
              {formatClock(remainingSec)}
            </div>
            <Button size="sm" variant="success" onClick={() => setSubmitOpen(true)}>
              <Send className="h-3.5 w-3.5" aria-hidden /> Submit
            </Button>
          </div>
        </div>

        {offline ? (
          <div className="border-t border-danger-500/30 bg-danger-50 px-4 py-1.5 text-center text-xs text-danger-600 dark:bg-danger-500/10 dark:text-danger-500">
            Connection lost. Keep working - your changes are queued and will save automatically when the connection returns.
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_320px]">
        <main id="main-content" className="min-w-0">
          {current ? (
            <Card className="min-h-[60vh]">
              <CardBody className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3 dark:border-ink-800">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                    <span className="rounded-md bg-ink-100 px-2 py-0.5 font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                      Q{current.order}
                    </span>
                    {current.sectionTitle ? <span>{current.sectionTitle}</span> : null}
                    <span aria-hidden>·</span>
                    <span>{current.subjectName}</span>
                    <span aria-hidden>·</span>
                    <span className="nums">
                      +{current.marks} / {current.negativeMarks > 0 ? `−${current.negativeMarks}` : "0"}
                    </span>
                    {current.type === "MULTIPLE_CHOICE" ? <Badge tone="brand">Multi-select</Badge> : null}
                  </div>
                  {answers[current.questionId]?.markedForReview ? <Badge tone="warn">Marked for review</Badge> : null}
                </div>

                <div className="flex-1 py-5" tabIndex={-1} id="question-region">
                  <p className="text-base leading-7 text-ink-900 dark:text-ink-50">
                    <MathText text={current.text} />
                  </p>
                  {current.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.imageUrl}
                      alt="Diagram for this question"
                      className="mt-4 max-h-72 rounded-lg border border-ink-200 object-contain dark:border-ink-700"
                    />
                  ) : null}

                  <fieldset className="mt-6">
                    <legend className="sr-only">Answer options</legend>
                    <div className="space-y-2.5">
                      {current.options.map((option, optionIndex) => {
                        const selected = answers[current.questionId]?.selectedOptionIds.includes(option.id) ?? false;
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                              selected
                                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                                : "border-ink-200 hover:border-brand-300 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800/60",
                            )}
                          >
                            <input
                              type={current.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                              name={`question-${current.questionId}`}
                              checked={selected}
                              onChange={() => selectOption(current, option.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 border-ink-300 text-brand-500 focus:ring-brand-500"
                            />
                            <span className="flex min-w-0 items-start gap-2.5 text-sm leading-6 text-ink-800 dark:text-ink-100">
                              <span className="nums font-semibold text-ink-500 dark:text-ink-400">
                                {String.fromCharCode(65 + optionIndex)}.
                              </span>
                              <MathText text={option.text} />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0}>
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearResponse(current)}
                      disabled={(answers[current.questionId]?.selectedOptionIds.length ?? 0) === 0}
                    >
                      <Eraser className="h-3.5 w-3.5" aria-hidden /> Clear response
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleMark(current)}>
                      <Flag className="h-3.5 w-3.5" aria-hidden />
                      {answers[current.questionId]?.markedForReview ? "Unmark" : "Mark for review"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        toggleMark(current, true);
                        goToQuestion(currentIndex + 1);
                      }}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" aria-hidden /> Mark & next
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => goToQuestion(currentIndex + 1)}
                      disabled={currentIndex >= questions.length - 1}
                    >
                      Save & next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <p className="text-sm text-ink-500">This attempt has no questions. Contact support with this attempt ID.</p>
              </CardBody>
            </Card>
          )}

          <div className="mt-4 lg:hidden">
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink-950 dark:text-ink-50">Question palette</h2>
                  <Button variant="secondary" size="sm" onClick={() => setInstructionsOpen(true)}>
                    Instructions
                  </Button>
                </div>
                {sections.length > 1 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <SectionTabs sections={sections} active={sectionFilter} onSelect={setSectionFilter} />
                  </div>
                ) : null}
                <QuestionPalette
                  questions={questions}
                  answers={answers}
                  currentIndex={currentIndex}
                  onSelect={goToQuestion}
                  sectionFilter={sectionFilter}
                />
              </CardBody>
            </Card>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink-950 dark:text-ink-50">Question palette</h2>
                  <Button variant="ghost" size="sm" onClick={() => setInstructionsOpen(true)}>
                    Instructions
                  </Button>
                </div>
                {sections.length > 1 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <SectionTabs sections={sections} active={sectionFilter} onSelect={setSectionFilter} />
                  </div>
                ) : null}
                <QuestionPalette
                  questions={questions}
                  answers={answers}
                  currentIndex={currentIndex}
                  onSelect={goToQuestion}
                  sectionFilter={sectionFilter}
                />
                <div className="mt-4 border-t border-ink-100 pt-3.5 dark:border-ink-800">
                  <PaletteLegend />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-500 dark:text-ink-400">Answered</span>
                  <span className="nums font-semibold text-success-600 dark:text-success-500">{answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 dark:text-ink-400">Not answered</span>
                  <span className="nums font-semibold text-danger-600 dark:text-danger-500">{unansweredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500 dark:text-ink-400">Marked for review</span>
                  <span className="nums font-semibold text-warn-600 dark:text-warn-500">{markedCount}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </aside>
      </div>

      <Modal
        open={submitOpen}
        onClose={() => (submitting ? undefined : setSubmitOpen(false))}
        title="Submit this attempt?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button variant="success" onClick={() => submit(false)} loading={submitting}>
              Submit final answers
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-600 dark:text-ink-300">
          <p>Submission is final. The scorecard is generated from the answers saved on the server at this moment.</p>
          <ul className="nums space-y-1.5 rounded-lg bg-ink-50 px-3.5 py-3 dark:bg-ink-800/60">
            <li>Answered: {answeredCount}</li>
            <li>Not answered: {unansweredCount}</li>
            <li>Marked for review: {markedCount}</li>
            <li>Time remaining: {formatClock(remainingSec)}</li>
          </ul>
          {unansweredCount > 0 && view.exam.negativeMarksPerWrong > 0 ? (
            <p className="text-xs leading-5 text-ink-500 dark:text-ink-400">
              Unanswered questions score 0 - there is no penalty for leaving a question blank.
            </p>
          ) : null}
          {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
        </div>
      </Modal>

      <Modal open={instructionsOpen} onClose={() => setInstructionsOpen(false)} title="Instructions" wide>
        <div className="space-y-3 text-sm leading-6 text-ink-600 dark:text-ink-300">
          <ul className="list-disc space-y-2 pl-5">
            <li>Your answers save automatically; the indicator in the header shows save state.</li>
            <li>
              Marking: +{view.exam.marksPerCorrect} for correct, {view.exam.negativeMarksPerWrong > 0 ? `−${view.exam.negativeMarksPerWrong} for wrong` : "no negative marking"}, 0 unanswered.
            </li>
            <li>The countdown is enforced by the server. Closing this tab does not pause the timer.</li>
            <li>At zero, the attempt submits automatically with the answers saved at that moment.</li>
            <li>Question palette colours: green answered, red visited but unanswered, amber marked for review.</li>
          </ul>
          {view.exam.instructions ? (
            <p className="rounded-lg bg-ink-50 px-3.5 py-3 dark:bg-ink-800/60">{view.exam.instructions}</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function SectionTabs({
  sections,
  active,
  onSelect,
}: {
  sections: { id: string; title: string }[];
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium",
          active === null ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300",
        )}
      >
        All
      </button>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelect(section.id)}
          className={cn(
            "max-w-40 truncate rounded-md px-2.5 py-1 text-xs font-medium",
            active === section.id
              ? "bg-brand-500 text-white"
              : "bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300",
          )}
        >
          {section.title}
        </button>
      ))}
    </>
  );
}
