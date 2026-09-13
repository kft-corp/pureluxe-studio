import { cn } from "@/lib/utils/cn";

/**
 * Shared Studio control sizes — keep toolbars, chips, and CTAs consistent.
 * Prefer these over one-off min-h / text / padding classes.
 */
export const studioControl = {
  /** Toolbar / page CTAs (New client, More filters, Approve, Invite). */
  button:
    "inline-flex min-h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Compact row / pagination actions. */
  buttonSm:
    "inline-flex min-h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Filter chips / pill toggles. */
  chip: "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Search / text inputs in toolbars — matches toolbar button height. */
  field:
    "h-8 w-full rounded-md border border-border bg-surface-raised text-xs text-ink shadow-sm outline-none transition placeholder:text-ink-muted focus:border-brand-dark/35 focus:ring-2 focus:ring-brand-dark/10",
} as const;

export const studioTone = {
  primary: "bg-brand-dark text-on-dark shadow-sm hover:bg-brand-dark/90",
  secondary:
    "border border-border bg-surface-raised text-ink shadow-sm hover:bg-surface-hover",
  /** Quiet chrome (pagination, tertiary) — keeps size tokens, lighter than secondary. */
  ghost:
    "border border-border/70 bg-transparent text-ink-muted hover:border-border hover:bg-surface-raised hover:text-ink",
  /** Affirmative actions (Approve) — aligns with approved/active status badges. */
  success:
    "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 focus-visible:ring-emerald-700/25",
  /** Destructive / reset actions (Clear filters, remove). */
  danger:
    "bg-red-700 text-on-dark shadow-sm hover:bg-red-800 focus-visible:ring-red-700/25",
  /** Softer reset (clear filters) — not as alarming as solid danger. */
  dangerSoft:
    "border border-red-200 bg-red-50 text-red-700 shadow-sm hover:border-red-300 hover:bg-red-100 focus-visible:ring-red-700/20",
  chipIdle: "bg-surface-raised text-ink ring-border hover:bg-surface-hover",
  chipActive: "bg-brand-dark text-on-dark ring-brand-dark",
} as const;

export function studioButtonClass(
  variant:
    | "primary"
    | "secondary"
    | "ghost"
    | "success"
    | "danger"
    | "dangerSoft" = "secondary",
  size: "md" | "sm" = "md",
  className?: string,
) {
  return cn(
    size === "md" ? studioControl.button : studioControl.buttonSm,
    studioTone[variant],
    className,
  );
}

export function studioChipClass(active: boolean, className?: string) {
  return cn(
    studioControl.chip,
    active ? studioTone.chipActive : studioTone.chipIdle,
    className,
  );
}
