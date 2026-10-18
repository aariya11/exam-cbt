"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, FileClock, LayoutDashboard, Menu, Trophy, User, X } from "lucide-react";
import { cn } from "@/components/ui";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/attempts", label: "My attempts", icon: FileClock },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/achievements", label: "Achievements", icon: Trophy },
  { href: "/dashboard/profile", label: "Profile & privacy", icon: User },
];

export function StudentNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = items.map((item) => {
    const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
        )}
      >
        <item.icon className="h-4 w-4" aria-hidden />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 lg:hidden dark:border-ink-700 dark:text-ink-200"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        Menu
      </button>

      <nav aria-label="Student navigation" className="hidden lg:block">
        <div className="space-y-1">{links}</div>
        <p className="mt-6 px-3 text-xs leading-5 text-ink-400 dark:text-ink-500">
          Tip: use the leaderboards to see how your score compares with other aspirants.
        </p>
      </nav>

      {open ? (
        <nav aria-label="Student navigation" className="mt-3 space-y-1 rounded-xl border border-ink-200 bg-white p-2 lg:hidden dark:border-ink-800 dark:bg-ink-900/50">
          {links}
        </nav>
      ) : null}
    </>
  );
}
