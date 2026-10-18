import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, X } from "lucide-react";

type ClassValue = string | number | false | null | undefined | ClassValue[];

// Minimal class-name joiner (keeps the dependency surface small).
export function cn(...inputs: ClassValue[]): string {
  return inputs.flat(Infinity as 1).filter(Boolean).join(" ");
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 border border-transparent",
  secondary:
    "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 active:bg-ink-100 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-100 dark:hover:bg-ink-800",
  ghost:
    "bg-transparent text-ink-600 border border-transparent hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-50",
  danger: "bg-danger-500 text-white hover:bg-danger-600 border border-transparent",
  success: "bg-success-500 text-white hover:bg-success-600 border border-transparent",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={props.disabled || loading} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/* ---------------------------------- Form ----------------------------------- */

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200", className)} {...props}>
      {children}
    </label>
  );
}

const fieldClass =
  "block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-ink-50 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-100 dark:placeholder:text-ink-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-500">
      {children}
    </p>
  );
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input type="search" className={cn(fieldClass, "h-10 pl-9")} {...props} />
    </div>
  );
}

/* ---------------------------------- Surface -------------------------------- */

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-ink-800", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-ink-950 dark:text-ink-50">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/* ---------------------------------- Badge ---------------------------------- */

type BadgeTone = "neutral" | "brand" | "success" | "warn" | "danger";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  warn: "bg-warn-50 text-warn-600 dark:bg-warn-500/15 dark:text-warn-500",
  danger: "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function difficultyTone(difficulty: string): BadgeTone {
  if (difficulty === "EASY") return "success";
  if (difficulty === "HARD") return "danger";
  return "warn";
}

export function statusTone(status: string): BadgeTone {
  if (["PUBLISHED", "ACTIVE", "SUBMITTED"].includes(status)) return "success";
  if (["IN_REVIEW", "SCHEDULED", "AUTO_SUBMITTED"].includes(status)) return "warn";
  if (["RETIRED", "ARCHIVED", "INVALIDATED", "SUSPENDED"].includes(status)) return "danger";
  if (["APPROVED"].includes(status)) return "brand";
  return "neutral";
}

/* ---------------------------------- Alert ---------------------------------- */

type AlertTone = "info" | "success" | "warn" | "danger";

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const styles: Record<AlertTone, string> = {
    info: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100",
    success:
      "border-success-500/30 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500",
    warn: "border-warn-500/30 bg-warn-50 text-warn-600 dark:border-warn-500/30 dark:bg-warn-500/10 dark:text-warn-500",
    danger:
      "border-danger-500/30 bg-danger-50 text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-500",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "warn" || tone === "danger" ? AlertTriangle : Info;
  return (
    <div role="status" className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm", styles[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("text-xs leading-5", title ? "mt-1" : "")}>{children}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------- Misc primitives --------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-100 dark:bg-ink-800", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 px-6 py-12 text-center dark:border-ink-700">
      {icon ? <div className="mb-3 text-ink-400">{icon}</div> : null}
      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</p>
        {icon ? <span className="text-ink-400">{icon}</span> : null}
      </div>
      <p className="nums mt-1.5 text-xl font-semibold tracking-tight text-ink-950 dark:text-ink-50">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800", className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3">
      <p className="nums text-xs text-ink-500 dark:text-ink-400">
        Page {page} of {pages} · {total} row(s)
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next
        </Button>
      </div>
    </nav>
  );
}

/* ---------------------------------- Table ---------------------------------- */

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-ink-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:border-ink-700 dark:text-ink-400",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-ink-100 px-3 py-2.5 text-ink-700 dark:border-ink-800 dark:text-ink-200", className)} {...props}>
      {children}
    </td>
  );
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl dark:bg-ink-900",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5 dark:border-ink-800">
          <h2 className="text-sm font-semibold text-ink-950 dark:text-ink-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3.5 dark:border-ink-800">{footer}</div> : null}
      </div>
    </div>
  );
}
