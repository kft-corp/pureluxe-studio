import { cn } from "@/lib/utils/cn";

/**
 * Shared Studio control sizes — keep toolbars, chips, and CTAs consistent.
 * Prefer these over one-off min-h / text / padding classes.
 */
export const studioControl = {
  /** Primary / secondary toolbar actions (Invite, New client, More filters). */
  button:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Compact row / pagination actions. */
  buttonSm:
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Filter chips / pill toggles. */
  chip: "inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/15",
  /** Search / text inputs in toolbars. */
  field:
    "h-9 w-full rounded-lg border border-border bg-surface-raised text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-muted focus:border-brand-dark/35 focus:ring-2 focus:ring-brand-dark/10",
} as const;

export const studioTone = {
  primary: "bg-brand-dark text-on-dark shadow-sm hover:bg-brand-dark/90",
  secondary:
    "border border-border bg-surface-raised text-ink shadow-sm hover:bg-surface-hover",
  chipIdle: "bg-surface-raised text-ink ring-border hover:bg-surface-hover",
  chipActive: "bg-brand-dark text-on-dark ring-brand-dark",
} as const;

export function studioButtonClass(
  variant: "primary" | "secondary" = "secondary",
  size: "md" | "sm" = "md",
  className?: string,
) {
  return cn(
    size === "md" ? studioControl.button : studioControl.buttonSm,
    variant === "primary" ? studioTone.primary : studioTone.secondary,
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
