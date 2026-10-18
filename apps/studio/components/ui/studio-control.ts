import { cn } from "@/lib/utils/cn";

/** Keyboard focus ring shared by every Studio control (3.8:1 against white). */
export const studioFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-surface-raised";

/**
 * Shared Studio control sizes — keep toolbars, chips, and CTAs consistent.
 * Prefer these over one-off min-h / text / padding classes.
 */
export const studioControl = {
  /** Toolbar / page CTAs (New client, More filters, Approve, Invite). */
  button: cn(
    "inline-flex min-h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    studioFocusRing,
  ),
  /** Compact row / pagination actions. */
  buttonSm: cn(
    "inline-flex min-h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    studioFocusRing,
  ),
  /** Filter chips / pill toggles. */
  chip: cn(
    "inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors",
    studioFocusRing,
  ),
  /** Search / text inputs in toolbars — matches toolbar button height. */
  field:
    "h-8 w-full rounded-md border border-field-border bg-surface-subtle text-xs text-ink outline-none transition placeholder:text-ink-faint hover:border-ink-subtle focus:border-accent-strong focus:bg-surface-raised focus:ring-2 focus:ring-accent/25",
} as const;

export const studioTone = {
  primary:
    "bg-brand-dark text-on-dark shadow-sm hover:bg-brand-dark-hover",
  secondary:
    "border border-border bg-surface-raised text-ink shadow-sm hover:border-border-strong hover:bg-surface-hover",
  /** Quiet chrome (pagination, tertiary) — keeps size tokens, lighter than secondary. */
  ghost:
    "border border-border/70 bg-transparent text-ink-muted hover:border-border hover:bg-surface-raised hover:text-ink",
  /** Champagne CTA — dark ink on gold keeps 8:1 contrast. Use once per view at most. */
  accent:
    "bg-accent text-ink shadow-sm hover:bg-accent-hover",
  /** Affirmative actions (Approve) — aligns with approved/active status badges. */
  success: "bg-success text-white shadow-sm hover:bg-success-hover",
  /** Destructive / reset actions (Clear filters, remove). */
  danger: "bg-danger text-white shadow-sm hover:bg-danger-hover",
  /** Softer reset (clear filters) — not as alarming as solid danger. */
  dangerSoft:
    "border border-danger-line bg-danger-soft text-danger-ink shadow-sm hover:border-danger-ink/30 hover:bg-danger-line/60",
  chipIdle:
    "bg-surface-raised text-ink-muted ring-border hover:bg-surface-hover hover:text-ink",
  chipActive: "bg-accent-soft text-accent-ink ring-accent",
} as const;

export function studioButtonClass(
  variant:
    | "primary"
    | "secondary"
    | "ghost"
    | "accent"
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
