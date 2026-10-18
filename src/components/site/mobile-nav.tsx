"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/exams", label: "Examinations" },
  { href: "/mock-tests", label: "Mock Tests" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help Centre" },
];

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 lg:hidden dark:border-ink-700 dark:text-ink-300"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          className="absolute left-0 right-0 top-full z-40 border-b border-ink-200 bg-white px-4 pb-4 pt-2 shadow-pop lg:hidden dark:border-ink-800 dark:bg-ink-950"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                {link.label}
              </Link>
            ))}
            {!signedIn ? (
              <div className="mt-2 flex gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                <Link
                  href="/login"
                  className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-center text-sm font-medium text-ink-700 dark:border-ink-700 dark:text-ink-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white"
                >
                  Create account
                </Link>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
