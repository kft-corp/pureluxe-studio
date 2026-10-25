"use client";

import type { LegSplitCard } from "@pureluxe/ai/chat-stream";

import { cn } from "@/lib/utils/cn";

/**
 * Multi-city date split proposal under an agent reply (Stage 4).
 * Accept is a choice chip from the tool; this card only shows the proposed stays.
 */
export function TripBuilderLegSplit({
  split,
  className,
}: {
  split: LegSplitCard;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-3 overflow-hidden rounded-lg border border-border bg-surface-raised",
        className,
      )}
      data-testid="trip-builder-leg-split"
    >
      <p className="border-b border-border px-3 py-2 text-sm font-medium text-ink">
        {split.summary}
      </p>
      <ul className="divide-y divide-divider">
        {split.stays.map((stay) => (
          <li
            key={`${stay.city}-${stay.check_in}-${stay.check_out}`}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm"
          >
            <span className="font-medium text-ink">{stay.city}</span>
            <span className="text-ink-muted">
              {stay.check_in} → {stay.check_out}
              {stay.hotel ? ` · ${stay.hotel}` : ""}
              {stay.rooms != null ? ` · ${stay.rooms} room${stay.rooms === 1 ? "" : "s"}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
