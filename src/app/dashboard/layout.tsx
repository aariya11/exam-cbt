import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-context";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { UserMenu } from "@/components/site/user-menu";
import { StudentNav } from "@/components/dashboard/student-nav";
import { Alert } from "@/components/ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu user={{ username: user.username, displayName: user.displayName, role: user.role }} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <StudentNav />
        </aside>
        <main id="main-content" className="min-w-0">
          {!user.emailVerifiedAt ? (
            <Alert tone="warn" title="Your email is not verified" className="mb-5">
              Some actions are limited until you verify your email address. Open the verification link we emailed you, or
              request a new one from the verify-email page.
            </Alert>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
