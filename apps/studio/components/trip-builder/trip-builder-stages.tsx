"use client";

import { cn } from "@/lib/utils/cn";

import {
  TRIP_STAGE_LABELS,
  TRIP_STAGES,
  type TripStage,
} from "./trip-stages";

type TripBuilderStagesProps = {
  current: TripStage;
};

/** Dot stepper — Client · Stay · Rates · Package · Quote (active blinks). */
export function TripBuilderStages({ current }: TripBuilderStagesProps) {
  const currentIndex = TRIP_STAGES.indexOf(current);

  return (
    <nav aria-label="Trip stages" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-y-2">
        {TRIP_STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;

          return (
            <li key={stage} className="flex items-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className="mx-2 h-px w-4 shrink-0 bg-border sm:mx-2.5 sm:w-5"
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
