"use client";

import { LuPlus } from "react-icons/lu";

import { cn } from "@/lib/utils/cn";

export type TripBuilderChipVariant = "primary" | "secondary";
export type TripBuilderChipIcon = "plus";

export type TripBuilderChip = {
  id: string;
  label: string;
  onClick: () => void;
  /** Primary = soft mint confirm; secondary = cream outline. */
  variant?: TripBuilderChipVariant;
  icon?: TripBuilderChipIcon;
};

function ChipIcon({ icon }: { icon: TripBuilderChipIcon }) {
  if (icon === "plus") {
    return <LuPlus className="size-3 shrink-0" strokeWidth={2} aria-hidden />;
  }
  return null;
}

/**
 * Soft forest / cream chips — no black fills.
 * Primary: mint + forest text. Secondary: cream outline.
 */
export function TripBuilderActionChip({
  chip,
  disabled,
}: {
  chip: TripBuilderChip;
  disabled?: boolean;
}) {
  const primary = (chip.variant ?? "secondary") === "primary";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={chip.onClick}
      className={cn(
        "inline-flex h-auto min-h-10 max-w-full items-center gap-1 rounded-full px-3 py-2 text-left text-[13px] font-medium leading-snug transition-colors lg:h-7 lg:max-w-[18rem] lg:min-h-0 lg:py-0 lg:leading-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a4d3e]/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        primary
          ? "bg-[#e8f2ee] text-[#1a4d3e] ring-1 ring-[#1a4d3e]/30 hover:bg-[#dceae3] hover:ring-[#1a4d3e]/45"
          : "bg-[#faf9f7] text-ink ring-1 ring-border hover:bg-[#e8f2ee]/90 hover:text-[#1a4d3e] hover:ring-[#1a4d3e]/25",
      )}
    >
      {chip.icon ? <ChipIcon icon={chip.icon} /> : null}
      <span className="break-words lg:truncate">{chip.label}</span>
    </button>
  );
}
