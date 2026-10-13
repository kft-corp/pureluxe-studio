import { cn } from "@/lib/utils/cn";

import { journeyStage, type JourneyStageTone } from "@/lib/trips";
import type { JourneyCardItem } from "@/lib/api/trips";

const TONES: Record<JourneyStageTone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-500/15",
  waiting: "bg-amber-50 text-amber-800 ring-amber-600/15",
  active: "bg-sky-50 text-sky-800 ring-sky-600/15",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
  muted: "bg-stone-100 text-stone-500 ring-stone-500/10",
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
