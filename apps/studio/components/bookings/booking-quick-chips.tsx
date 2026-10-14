"use client";

import type { BookingQuickFilter } from "@pureluxe/shared";

import {
  BOOKING_QUICK_CHIP_OPTIONS,
  BOOKING_WORK_CHIP_SET,
} from "@/lib/bookings";
import { studioChipClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type BookingQuickChipsProps = {
  value: BookingQuickFilter[];
  onChange: (value: BookingQuickFilter[]) => void;
};

export function BookingQuickChips({ value, onChange }: BookingQuickChipsProps) {
  const selected = new Set(value);

  function toggle(filterId: BookingQuickFilter) {
    if (selected.has(filterId)) {
      onChange(value.filter((id) => id !== filterId));
      return;
    }

    if (BOOKING_WORK_CHIP_SET.has(filterId)) {
      onChange([
        ...value.filter((id) => !BOOKING_WORK_CHIP_SET.has(id)),
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
      {BOOKING_QUICK_CHIP_OPTIONS.map((filter) => {
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
