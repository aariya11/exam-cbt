"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Settings, Shield, User } from "lucide-react";
import { cn } from "@/components/ui";

type SessionUser = {
  username: string;
  displayName: string;
  role: string;
};

const staffRoles = ["QUESTION_EDITOR", "EXAM_MANAGER", "ADMIN", "SUPER_ADMIN"];

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const initials = user.displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-ink-200 py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-[11px] font-semibold text-white" aria-hidden>
          {initials}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{user.displayName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="border-b border-ink-100 px-3.5 py-2.5 dark:border-ink-800">
            <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{user.displayName}</p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">@{user.username}</p>
          </div>
          <Link
            role="menuitem"
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <LayoutDashboard className="h-4 w-4 text-ink-400" aria-hidden /> Dashboard
          </Link>
          <Link
            role="menuitem"
            href="/dashboard/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <User className="h-4 w-4 text-ink-400" aria-hidden /> Profile & privacy
          </Link>
          {staffRoles.includes(user.role) ? (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              <Shield className="h-4 w-4 text-ink-400" aria-hidden /> Administration
            </Link>
          ) : null}
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            disabled={busy}
            className={cn(
              "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-60 dark:text-ink-200 dark:hover:bg-ink-800",
            )}
          >
            <LogOut className="h-4 w-4 text-ink-400" aria-hidden /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminNavBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 dark:bg-ink-800 dark:text-ink-300">
      <Settings className="h-3 w-3" aria-hidden />
      {role.replace("_", " ").toLowerCase()}
    </span>
  );
}
