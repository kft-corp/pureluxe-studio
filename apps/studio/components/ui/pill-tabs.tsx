"use client";

import { cn } from "@/lib/utils/cn";

export type PillTabItem<T extends string> = {
  id: T;
  label: string;
};

type PillTabsProps<T extends string> = {
  items: readonly PillTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

/** Horizontal pill tab list — used for page sections and role pickers. */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: PillTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ring-1 transition-colors sm:px-4",
              isActive
                ? "bg-surface-raised text-ink shadow-sm ring-border/80"
                : "text-ink-muted ring-transparent hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
