import { cn } from "@/lib/utils/cn";

import { journeyStage, type JourneyStageTone } from "@/lib/trips";
import type { JourneyCardItem } from "@/lib/api/trips";

const TONES: Record<JourneyStageTone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink ring-neutral-line",
  waiting: "bg-warning-soft text-warning-ink ring-warning-line",
  active: "bg-info-soft text-info-ink ring-info-line",
  done: "bg-success-soft text-success-ink ring-success-line",
  muted: "bg-surface-subtle text-ink-subtle ring-border",
};

/** Trip stage pill, the same on the list and the trip page. */
export function JourneyPhasePill({
  journey,
}: {
  journey: Pick<JourneyCardItem, "phase" | "status">;
}) {
  const stage = journeyStage(journey);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONES[stage.tone],
      )}
    >
      {stage.label}
    </span>
  );
}
