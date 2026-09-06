"use client";

import { LuSearch, LuX } from "react-icons/lu";

import { studioControl } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type StudioSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  className?: string;
};

/** Shared toolbar search field used by Clients and Team directories. */
export function StudioSearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: StudioSearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <LuSearch
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          studioControl.field,
          "pr-9 pl-9",
          // Hide browser native clear — we render our own X.
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          aria-label="Clear search"
        >
          <LuX className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
