import Link from "next/link";
import { cn } from "@/components/ui";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="RankForge home">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white"
      >
        R
      </span>
      <span className="text-base font-semibold tracking-tight text-ink-950 dark:text-ink-50">
        Rank<span className="text-brand-500">Forge</span>
      </span>
    </Link>
  );
}
