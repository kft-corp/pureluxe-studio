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
 * Stage track — Client · Stay · Rates · Package · Quote.
 * Small screens: compact pills, every name visible. Wider screens: dots and labels.
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
        "transition-opacity",
        !tripOpen && "pointer-events-none select-none opacity-40",
      )}
    >
      <ol
        className={cn(
          "flex flex-wrap items-center gap-1",
          "lg:w-full lg:min-w-0 lg:flex-nowrap lg:gap-0 lg:overflow-x-auto",
          "lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
        )}
      >
        {TRIP_STAGES.map((stage, index) => {
          const done = tripOpen && index < currentIndex;
          const active = tripOpen && index === currentIndex;

          return (
            <li key={stage} className="flex shrink-0 items-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2.5 hidden h-px w-5 shrink-0 lg:block",
                    tripOpen && index <= currentIndex
                      ? "bg-[#b7d4c8]"
                      : "bg-border",
                  )}
                />
              ) : null}

              <span
                className={cn(
                  "inline-flex items-center lg:gap-1.5",
                  "h-8 rounded-full px-2.5 lg:h-auto lg:rounded-none lg:px-0",
                  active && "bg-[#e8f2ee] ring-1 ring-[#1a4d3e]/25 lg:bg-transparent lg:ring-0",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative hidden h-2.5 w-2.5 shrink-0 items-center justify-center lg:flex",
                    active && "trip-stage-dot-active",
                  )}
                >
                  {active ? (
                    <span className="trip-stage-dot-halo absolute inset-[-4px] rounded-full bg-[#3d8f72]/20" />
                  ) : null}
                  <span
                    className={cn(
                      "relative h-2 w-2 rounded-full",
                      active && "bg-[#3d8f72]",
                      done && !active && "bg-[#7dbaa4]",
                      !done && !active && "bg-ink-subtle/70",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-wide sm:text-xs",
                    active && "font-semibold text-[#1a4d3e] lg:text-[#2f6b56]",
                    done && !active && "text-[#3f8f74]",
                    !done && !active && "text-ink-subtle",
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
