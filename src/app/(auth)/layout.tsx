import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-950">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-ink-400 dark:text-ink-500">
        RankForge · Independent practice platform · Not affiliated with any examination authority
      </footer>
    </div>
  );
}
