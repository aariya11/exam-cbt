import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-context";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { buttonClass } from "@/components/ui";

const navLinks = [
  { href: "/exams", label: "Examinations" },
  { href: "/mock-tests", label: "Mock Tests" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help Centre" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <UserMenu user={{ username: user.username, displayName: user.displayName, role: user.role }} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className={buttonClass("ghost", "md")}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClass("primary", "md")}>
                Start practising
              </Link>
            </div>
          )}
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
