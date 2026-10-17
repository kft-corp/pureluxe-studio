import type { IconType } from "react-icons";

import { cn } from "@/lib/utils/cn";

type StatusBadgeProps = {
  status: "active" | "inactive" | "pending" | "approved";
  className?: string;
};

const STATUS_STYLES = {
  active: "bg-success-soft text-success-ink ring-success-line",
  inactive: "bg-neutral-soft text-neutral-ink ring-neutral-line",
  pending: "bg-warning-soft text-warning-ink ring-warning-line",
  approved: "bg-success-soft text-success-ink ring-success-line",
} as const;

const STATUS_DOTS = {
  active: "bg-success-dot",
  inactive: "bg-neutral-dot",
  pending: "bg-warning-dot",
  approved: "bg-success-dot",
} as const;

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  approved: "Approved",
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
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])}
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
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-subtle text-ink-muted">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mt-4 max-w-xs wrap-break-word text-pretty text-sm leading-relaxed text-ink-muted">
        {message}
      </p>
    </div>
  );
}
