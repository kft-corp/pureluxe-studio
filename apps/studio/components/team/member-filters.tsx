"use client";

import { studioChipClass } from "@/components/ui";
import type { MemberFilter } from "@/lib/team/member-filter-utils";
import { cn } from "@/lib/utils/cn";

export type { MemberFilter };

type MemberFiltersProps = {
  value: MemberFilter;
  onChange: (value: MemberFilter) => void;
  counts?: Partial<Record<MemberFilter, number>>;
};

const FILTERS: Array<{ id: MemberFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

export function MemberFilters({ value, onChange, counts }: MemberFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="inline-flex max-w-full flex-wrap gap-1.5"
    >
      {FILTERS.map((filter) => {
        const isActive = filter.id === value;
        const count = counts?.[filter.id];

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(filter.id)}
            className={studioChipClass(isActive)}
          >
            {filter.label}
            {count !== undefined ? (
              <span
                className={cn(
                  "ml-1 min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                  isActive ? "bg-white/20 text-on-dark" : "bg-surface text-ink-muted",
                  count === 0 && "opacity-40",
                )}
                aria-hidden={count === 0}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
