"use client";

import { LuPlus } from "react-icons/lu";

import { cn } from "@/lib/utils/cn";

export type TripBuilderChipVariant = "primary" | "secondary" | "danger";
export type TripBuilderChipIcon = "plus";

export type TripBuilderChip = {
  id: string;
  label: string;
  onClick: () => void;
  /** Primary = soft mint confirm; secondary = cream outline; danger = removes or cancels something. */
  variant?: TripBuilderChipVariant;
  icon?: TripBuilderChipIcon;
};

function ChipIcon({ icon }: { icon: TripBuilderChipIcon }) {
  if (icon === "plus") {
    return <LuPlus className="size-3 shrink-0" strokeWidth={2} aria-hidden />;
  }
  return null;
}

const VARIANT_CLASS: Record<TripBuilderChipVariant, string> = {
  primary:
    "bg-[#e8f2ee] text-[#1a4d3e] ring-1 ring-[#1a4d3e]/30 hover:bg-[#dceae3] hover:ring-[#1a4d3e]/45",
  secondary:
    "bg-[#faf9f7] text-ink ring-1 ring-border hover:bg-[#e8f2ee]/90 hover:text-[#1a4d3e] hover:ring-[#1a4d3e]/25",
  danger:
    "bg-[#fdf3f2] text-[#9b2c2c] ring-1 ring-[#9b2c2c]/30 hover:bg-[#fbe7e5] hover:ring-[#9b2c2c]/45",
};

/**
 * Soft forest / cream chips — no black fills.
 * Primary: mint + forest text. Secondary: cream outline. Danger: soft rose outline.
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a4d3e]/20",
        "disabled:cursor-not-allowed",
        running ? "disabled:opacity-90" : "disabled:opacity-50",
        VARIANT_CLASS[chip.variant ?? "secondary"],
      )}
    >
      {running ? (
        <span className="relative size-3 shrink-0" aria-hidden>
          <span className="morphing-spinner-shape absolute inset-0 bg-current" />
        </span>
      ) : chip.icon ? (
        <ChipIcon icon={chip.icon} />
      ) : null}
      <span className="break-words lg:truncate">{chip.label}</span>
    </button>
  );
}
