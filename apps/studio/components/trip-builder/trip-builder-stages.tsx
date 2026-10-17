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
  /** Confirmed or completed trip: every stage shows as done. */
  finished?: boolean;
  /** Cancelled trip: the track is greyed out. */
  muted?: boolean;
};

/**
 * Stage track — Client · Stay · Rates · Quote · Booking.
 * Small screens: compact pills, every name visible. Wider screens: dots and labels.
 */
export function TripBuilderStages({ current, finished = false, muted = false }: TripBuilderStagesProps) {
  const currentIndex = current
    ? finished
      ? TRIP_STAGES.length
      : TRIP_STAGES.indexOf(current)
    : -1;
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
        (!tripOpen || muted) && "pointer-events-none select-none opacity-40",
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
                      ? "bg-success-dot/50"
                      : "bg-border",
                  )}
                />
              ) : null}

              <span
                className={cn(
                  "inline-flex items-center lg:gap-1.5",
                  "h-8 rounded-full px-2.5 lg:h-auto lg:rounded-none lg:px-0",
                  active && "bg-success-soft ring-1 ring-success-line lg:bg-transparent lg:ring-0",
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
                    <span className="trip-stage-dot-halo absolute inset-[-4px] rounded-full bg-success-dot/20" />
                  ) : null}
                  <span
                    className={cn(
                      "relative h-2 w-2 rounded-full",
                      active && "bg-success",
                      done && !active && "bg-success-dot",
                      !done && !active && "bg-ink-faint",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-wide sm:text-xs",
                    active && "font-semibold text-success-ink",
                    done && !active && "text-success-ink",
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
