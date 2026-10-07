"use client";

import { cn } from "@/lib/utils/cn";

import {
  TRIP_STAGE_LABELS,
  TRIP_STAGES,
  type TripStage,
} from "./stages";

type TripBuilderStagesProps = {
  /** Current stage when a trip is open; null on home (no blink). */
  current: TripStage | null;
};

/**
 * Dot stepper — Client · Stay · Rates · Package · Quote.
 * Mobile: dots + current label only. Desktop: full labels.
 */
export function TripBuilderStages({ current }: TripBuilderStagesProps) {
  const currentIndex = current ? TRIP_STAGES.indexOf(current) : -1;
  const tripOpen = currentIndex >= 0;

  return (
    <nav
      aria-label={
        tripOpen
          ? "Trip stages"
          : "Trip stages (inactive until a trip is created)"
      }
      className={cn(
        "min-w-0 transition-opacity",
        !tripOpen && "pointer-events-none select-none opacity-40",
      )}
    >
      <ol className="flex items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TRIP_STAGES.map((stage, index) => {
          const done = tripOpen && index < currentIndex;
          const active = tripOpen && index === currentIndex;

          return (
            <li key={stage} className="flex shrink-0 items-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className="mx-1.5 h-px w-2.5 shrink-0 bg-border sm:mx-2.5 sm:w-5"
                />
              ) : null}

              <span
                className="inline-flex items-center gap-1.5"
                aria-current={active ? "step" : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative flex h-2.5 w-2.5 shrink-0 items-center justify-center",
                    active && "trip-stage-dot-active",
                  )}
                >
                  {active ? (
                    <span className="trip-stage-dot-halo absolute inset-[-4px] rounded-full bg-emerald-900/20" />
                  ) : null}
                  <span
                    className={cn(
                      "relative h-2 w-2 rounded-full",
                      active && "bg-emerald-900",
                      done && !active && "bg-ink-muted",
                      !done && !active && "bg-ink-subtle/70",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-wide sm:text-xs",
                    active && "font-semibold text-emerald-950",
                    done && !active && "text-ink-muted",
                    !done && !active && "text-ink-subtle",
                    // Mobile: only show the active (or first) label to save width
                    active || (!tripOpen && index === 0)
                      ? "inline"
                      : "hidden sm:inline",
                  )}
                >
                  {TRIP_STAGE_LABELS[stage]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
