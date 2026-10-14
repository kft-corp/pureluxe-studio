"use client";

import { studioChipClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import {
  JOURNEY_QUICK_CHIP_OPTIONS,
  JOURNEY_STAGE_CHIP_SET,
  type JourneyQuickFilter,
} from "@/lib/trips";

type TripQuickChipsProps = {
  value: JourneyQuickFilter[];
  onChange: (value: JourneyQuickFilter[]) => void;
};

export function TripQuickChips({ value, onChange }: TripQuickChipsProps) {
  const selected = new Set(value);

  function toggle(filterId: JourneyQuickFilter) {
    if (selected.has(filterId)) {
      onChange(value.filter((id) => id !== filterId));
      return;
    }

    if (JOURNEY_STAGE_CHIP_SET.has(filterId)) {
      onChange([
        ...value.filter((id) => !JOURNEY_STAGE_CHIP_SET.has(id)),
        filterId,
      ]);
      return;
    }

    onChange([...value, filterId]);
  }

  return (
    <div
      role="group"
      aria-label="Quick filters"
      className={cn(
        "-mx-1 flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5",
        "scroll-smooth scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {JOURNEY_QUICK_CHIP_OPTIONS.map((filter) => {
        const isActive = selected.has(filter.id);

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => toggle(filter.id)}
            className={cn(studioChipClass(isActive), "shrink-0")}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
