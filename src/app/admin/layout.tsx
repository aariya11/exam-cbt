import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-context";
import { isAtLeastRole, ROLES } from "@/lib/constants";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { UserMenu } from "@/components/site/user-menu";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAtLeastRole(user.role, ROLES.QUESTION_EDITOR)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <span className="hidden rounded-md bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600 sm:inline dark:bg-ink-800 dark:text-ink-300">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden text-xs font-medium text-ink-500 hover:text-ink-800 sm:block dark:text-ink-400 dark:hover:text-ink-100"
            >
              Student view
            </Link>
            <ThemeToggle />
            <UserMenu user={{ username: user.username, displayName: user.displayName, role: user.role }} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <AdminNav role={user.role} />
        </aside>
        <main id="main-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
