import Link from "next/link";
import { Logo } from "./logo";

const columns: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { href: "/exams", label: "Examinations" },
      { href: "/mock-tests", label: "Mock tests" },
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About us" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact us" },
      { href: "/accessibility", label: "Accessibility" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/cookies", label: "Cookie policy" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-ink-500 dark:text-ink-400">
              A timed computer-based mock test platform for national competitive examinations in India.
            </p>
            <p className="mt-4 max-w-xs text-xs leading-5 text-ink-400 dark:text-ink-500">
              RankForge is an independent practice platform. It is not affiliated with, endorsed by, or connected to any
              examination authority or government body.
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-900 dark:text-ink-100">{column.title}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-500 transition-colors hover:text-brand-600 dark:text-ink-400 dark:hover:text-brand-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-ink-100 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800 dark:text-ink-400">
          <p>© {year} RankForge. All rights reserved.</p>
          <p>Made for serious aspirants.</p>
        </div>
      </div>
    </footer>
  );
}
