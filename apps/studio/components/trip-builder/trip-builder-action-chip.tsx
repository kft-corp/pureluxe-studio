"use client";

import { LuPlus, LuUndo2 } from "react-icons/lu";

import { Spinner } from "@/components/feedback";
import { cn } from "@/lib/utils/cn";

export type TripBuilderChipVariant = "primary" | "secondary" | "danger";
export type TripBuilderChipIcon = "plus" | "undo";

export type TripBuilderChip = {
  id: string;
  label: string;
  onClick: () => void;
  /** Primary = champagne confirm; secondary = quiet outline; danger = removes or cancels something. */
  variant?: TripBuilderChipVariant;
  icon?: TripBuilderChipIcon;
};

function ChipIcon({ icon }: { icon: TripBuilderChipIcon }) {
  const Icon = icon === "plus" ? LuPlus : LuUndo2;
  return <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden />;
}

const VARIANT_CLASS: Record<TripBuilderChipVariant, string> = {
  primary:
    "bg-accent-soft text-accent-ink ring-1 ring-accent hover:bg-accent-line/70 hover:text-accent-ink-strong",
  secondary:
    "bg-surface-subtle text-ink ring-1 ring-border hover:bg-accent-soft hover:text-accent-ink hover:ring-accent-line",
  danger:
    "bg-danger-soft text-danger-ink ring-1 ring-danger-line hover:bg-danger-line/60 hover:ring-danger-ink/30",
};

/**
 * Soft champagne / neutral chips — no black fills.
 * Primary: champagne + bronze text. Secondary: quiet outline. Danger: soft rose outline.
 */
export function TripBuilderActionChip({
  chip,
  disabled,
  running,
}: {
  chip: TripBuilderChip;
  disabled?: boolean;
  /** This chip's action is in flight. */
  running?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={chip.onClick}
      title={chip.label}
      aria-busy={running || undefined}
      className={cn(
        "inline-flex h-auto min-h-10 max-w-full items-center gap-1 rounded-full px-3 py-2 text-left text-[13px] font-medium leading-snug transition-colors lg:h-7 lg:max-w-[18rem] lg:min-h-0 lg:py-0 lg:leading-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong",
        "disabled:cursor-not-allowed",
        running ? "disabled:opacity-90" : "disabled:opacity-50",
        VARIANT_CLASS[chip.variant ?? "secondary"],
      )}
    >
      {running ? (
        <Spinner size="xs" tone="current" />
      ) : chip.icon ? (
        <ChipIcon icon={chip.icon} />
      ) : null}
      <span className="break-words lg:truncate">{chip.label}</span>
    </button>
  );
}
