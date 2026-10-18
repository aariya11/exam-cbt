import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">{title}</h1>
        <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">Last updated: {updated}</p>
        <p className="mt-4 text-sm leading-6 text-ink-600 dark:text-ink-300">{intro}</p>
      </header>
      <article className="prose-legal mt-2 pb-6">{children}</article>
    </div>
  );
}
