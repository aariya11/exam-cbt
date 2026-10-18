import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center dark:bg-ink-950">
      <p className="nums text-sm font-semibold tracking-wide text-brand-600 dark:text-brand-300">404</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950 dark:text-ink-50">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-ink-500 dark:text-ink-400">
        The page you are looking for does not exist, may have been moved, or is not available to your account.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Back to home
        </Link>
        <Link
          href="/mock-tests"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
        >
          Browse mock tests
        </Link>
      </div>
    </div>
  );
}
