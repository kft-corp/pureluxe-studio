import type { IconType } from "react-icons";

import { cn } from "@/lib/utils/cn";

type StatusBadgeProps = {
  status: "active" | "inactive" | "pending";
  className?: string;
};

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-600/10",
  inactive: "bg-stone-100 text-stone-600 ring-stone-500/10",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/10",
} as const;

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active" && "bg-emerald-500",
          status === "inactive" && "bg-stone-400",
          status === "pending" && "bg-amber-500",
        )}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

type EmptyStateProps = {
  icon: IconType;
  message: string;
};

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-ink-muted">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
        {message}
      </p>
    </div>
  );
}
