"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  FileSearch,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/components/ui";
import { ROLES, isAtLeastRole, type Role } from "@/lib/constants";

const items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; min: Role }> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, min: ROLES.QUESTION_EDITOR },
  { href: "/admin/exams", label: "Examinations", icon: BookOpen, min: ROLES.EXAM_MANAGER },
  { href: "/admin/questions", label: "Question bank", icon: FileText, min: ROLES.QUESTION_EDITOR },
  { href: "/admin/users", label: "Users", icon: Users, min: ROLES.ADMIN },
  { href: "/admin/alerts", label: "Integrity alerts", icon: ShieldAlert, min: ROLES.EXAM_MANAGER },
  { href: "/admin/audit", label: "Audit log", icon: FileSearch, min: ROLES.ADMIN },
  { href: "/admin/settings", label: "Settings", icon: Settings, min: ROLES.ADMIN },
];

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const visible = items.filter((item) => isAtLeastRole(role, item.min));

  const links = visible.map((item) => {
    const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
        Admin menu
      </button>

      <nav aria-label="Administration navigation" className="hidden lg:block">
        <div className="space-y-1">{links}</div>
        <div className="mt-6 rounded-xl border border-ink-200 p-3 dark:border-ink-800">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Your access level
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-400">
            {role.replaceAll("_", " ").toLowerCase()} — actions are limited by your role and every change is audited.
          </p>
        </div>
      </nav>

      {open ? (
        <nav
          aria-label="Administration navigation"
          className="mt-3 space-y-1 rounded-xl border border-ink-200 bg-white p-2 lg:hidden dark:border-ink-800 dark:bg-ink-900/50"
        >
          {links}
        </nav>
      ) : null}
    </>
  );
}
