"use client";

import { LuUndo2 } from "react-icons/lu";

import { Spinner } from "@/components/feedback";
import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

/** Composer chip kinds — Undo only (Confirm/Cancel and choices are typed in chat). */
export type TripBuilderChipKind = "undo";

export type TripBuilderChip = {
  id: string;
  label: string;
  onClick: () => void;
  kind?: TripBuilderChipKind;
  /** Kept for callers; Undo always uses the quiet text style. */
  variant?: "primary" | "secondary" | "danger";
  icon?: "undo";
};

const UNDO_CLASS = cn(
  "inline-flex max-w-full items-center gap-1.5 text-left text-[13px] font-medium leading-snug transition-colors",
  "min-h-10 rounded-lg px-3 py-2 lg:min-h-8 lg:py-1",
  "-ml-3 text-ink-subtle hover:text-ink",
  "disabled:cursor-not-allowed",
  studioFocusRing,
);

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
      aria-busy={running || undefined}
      className={cn(UNDO_CLASS, running ? "disabled:opacity-90" : "disabled:opacity-50")}
    >
      {running ? (
        <Spinner size="xs" tone="current" />
      ) : (
        <LuUndo2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      )}
      <span className="min-w-0 break-words">{chip.label}</span>
    </button>
  );
}
