"use client";

import { cn } from "@/lib/utils/cn";

export type PillTabItem<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
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
      className={cn(
        "relative min-w-0",
        /* Soft edge fades hint that the strip scrolls on narrow screens */
        "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-4 before:rounded-l-xl before:bg-linear-to-r before:from-surface before:to-transparent",
        "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-4 after:rounded-r-xl after:bg-linear-to-l after:from-surface after:to-transparent",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-surface p-1 scroll-smooth scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.id === value;
          const isDisabled = Boolean(item.disabled);

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={isDisabled ? "Coming soon" : undefined}
              onClick={() => {
                if (!isDisabled) onChange(item.id);
              }}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium ring-1 transition-colors sm:px-4",
                isDisabled &&
                  "cursor-not-allowed text-ink-subtle opacity-55 ring-transparent",
                !isDisabled &&
                  isActive &&
                  "bg-surface-raised text-ink shadow-sm ring-border/80",
                !isDisabled &&
                  !isActive &&
                  "text-ink-muted ring-transparent hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
