"use client";

import { LuChevronRight, LuPlus, LuUndo2 } from "react-icons/lu";

import { Spinner } from "@/components/feedback";
import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export type TripBuilderChipVariant = "primary" | "secondary" | "danger";
export type TripBuilderChipIcon = "plus" | "undo";
/** Agent card chips. Without a kind the chip is a ready action. */
export type TripBuilderChipKind = "confirm" | "cancel" | "choice" | "undo";

export type TripBuilderChip = {
  id: string;
  label: string;
  onClick: () => void;
  /** Among ready actions, primary or danger marks the lead; the rest are text buttons. */
  variant?: TripBuilderChipVariant;
  kind?: TripBuilderChipKind;
  icon?: TripBuilderChipIcon;
};

function ChipIcon({ icon }: { icon: TripBuilderChipIcon }) {
  const Icon = icon === "plus" ? LuPlus : LuUndo2;
  return <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />;
}

const BUTTON_CLASS = cn(
  "inline-flex max-w-full items-center gap-1.5 text-left text-[13px] font-medium leading-snug transition-colors",
  "disabled:cursor-not-allowed",
  studioFocusRing,
);

/** Softly rounded ready action; also the size for Undo. */
const READY_SIZE = "min-h-10 rounded-lg px-3 py-2 lg:min-h-8 lg:py-1";
/** Small approval buttons. */
const SMALL_SIZE = "min-h-9 rounded-md px-3 py-1.5 lg:min-h-7 lg:py-1";

function chipClass(chip: TripBuilderChip): string {
  switch (chip.kind) {
    case "confirm":
      return cn(BUTTON_CLASS, SMALL_SIZE, "bg-cta text-white shadow-sm hover:bg-cta-hover");
    case "cancel":
      return cn(BUTTON_CLASS, SMALL_SIZE, "text-ink-muted hover:bg-surface-hover hover:text-ink");
    case "undo":
      return cn(BUTTON_CLASS, READY_SIZE, "-ml-3 text-ink-subtle hover:text-ink");
    case "choice":
      return cn(
        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] leading-snug text-ink transition-colors",
        "min-h-11 hover:bg-surface-hover lg:min-h-9 lg:py-2",
        "disabled:cursor-not-allowed",
        studioFocusRing,
      );
    default:
      return chip.variant === "primary" || chip.variant === "danger"
        ? cn(BUTTON_CLASS, READY_SIZE, "bg-accent-soft text-accent-ink hover:bg-accent-line/70 hover:text-accent-ink-strong")
        : cn(BUTTON_CLASS, READY_SIZE, "text-ink-muted hover:bg-surface-hover hover:text-ink");
  }
}

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
  const icon = chip.icon ?? (chip.kind === "undo" ? "undo" : undefined);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={chip.onClick}
      aria-busy={running || undefined}
      className={cn(chipClass(chip), running ? "disabled:opacity-90" : "disabled:opacity-50")}
    >
      {running ? <Spinner size="xs" tone="current" /> : icon ? <ChipIcon icon={icon} /> : null}
      <span className={cn("min-w-0 break-words", chip.kind === "choice" && "flex-1")}>{chip.label}</span>
      {chip.kind === "choice" ? (
        <LuChevronRight className="size-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden />
      ) : null}
    </button>
  );
}
