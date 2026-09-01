"use client";

import { cn } from "@/lib/utils/cn";
import type { MemberFilter } from "@/lib/team/member-filter-utils";

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
      aria-label="Filter members"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border bg-surface p-1"
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
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium ring-1 transition-colors",
              isActive
                ? "bg-surface-raised text-ink shadow-sm ring-border/80"
                : "text-ink-muted ring-transparent hover:text-ink",
            )}
          >
            {filter.label}
            {count !== undefined ? (
              <span
                className={cn(
                  "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                  isActive ? "bg-surface text-ink-muted" : "text-ink-subtle",
                  count === 0 && "opacity-0",
                )}
                aria-hidden={count === 0}
              >
                {count || 0}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
