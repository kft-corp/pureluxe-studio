import {
  JOURNEY_WORK_STAGES,
  type JourneyStageFilter,
  type ListJourneysQuery,
} from "@pureluxe/shared";

/** Toolbar chips. Mine is scope. The rest pick one coarse stage. */
export type JourneyQuickFilter = "mine" | "working" | "upcoming" | "on_trip";

/** Finer stage, used in More filters. */
export const TRIP_DETAIL_STAGES = [
  "any",
  ...JOURNEY_WORK_STAGES,
  "past",
] as const;

export type TripDetailStage = (typeof TRIP_DETAIL_STAGES)[number];

export const JOURNEY_STAGE_CHIP_IDS = [
  "working",
  "upcoming",
  "on_trip",
] as const satisfies readonly JourneyQuickFilter[];

export const JOURNEY_STAGE_CHIP_SET = new Set<string>(JOURNEY_STAGE_CHIP_IDS);

export const JOURNEY_QUICK_CHIP_OPTIONS: Array<{
  id: JourneyQuickFilter;
  label: string;
}> = [
  { id: "working", label: "Working" },
  { id: "upcoming", label: "Upcoming" },
  { id: "on_trip", label: "On trip" },
  { id: "mine", label: "Mine" },
];

/** The one stage chip, or any when none is selected. */
export function stageFromQuickFilters(
  filters: JourneyQuickFilter[],
): JourneyStageFilter {
  const stage = filters.find((id) => JOURNEY_STAGE_CHIP_SET.has(id));
  return (stage as JourneyStageFilter | undefined) ?? "any";
}

/** A More filters stage wins. Otherwise the chip. */
export function directoryStage(
  filters: JourneyQuickFilter[],
  detail: TripDetailStage,
): JourneyStageFilter {
  if (detail !== "any") return detail;
  return stageFromQuickFilters(filters);
}

export type TripOwnerFilterOption = {
  id: string;
  name: string;
};

/** More filters. Coarse stage stays on the chips. */
export type TripAdvancedFilters = {
  stage: TripDetailStage;
  client_tier: ListJourneysQuery["client_tier"];
  price: ListJourneysQuery["price"];
  quote: ListJourneysQuery["quote"];
  payment: ListJourneysQuery["payment"];
  owner: string;
  starts_from: string;
  starts_to: string;
};

export const EMPTY_TRIP_ADVANCED_FILTERS: TripAdvancedFilters = {
  stage: "any",
  client_tier: "any",
  price: "any",
  quote: "any",
  payment: "any",
  owner: "any",
  starts_from: "",
  starts_to: "",
};

const WORK_DETAIL_STAGES = new Set<TripDetailStage>(JOURNEY_WORK_STAGES);

/** Keep Mine and Working aligned with the form. */
export function syncTripQuickFilters(
  current: JourneyQuickFilter[],
  value: TripAdvancedFilters,
): JourneyQuickFilter[] {
  let stageChips = current.filter((id) => JOURNEY_STAGE_CHIP_SET.has(id));
  if (WORK_DETAIL_STAGES.has(value.stage)) {
    stageChips = ["working"];
  } else if (value.stage === "past") {
    stageChips = [];
  }

  const keepMine =
    value.owner === "me" ? true : value.owner !== "any" ? false : current.includes("mine");
  return keepMine ? [...stageChips, "mine"] : stageChips;
}

/** Drop a More filters stage that no longer matches the chip the advisor just picked. */
export function stageDetailForChips(
  filters: JourneyQuickFilter[],
  detail: TripDetailStage,
): TripDetailStage {
  const chip = stageFromQuickFilters(filters);
  if (chip === "working") {
    return detail === "past" ? "any" : detail;
  }
  if (WORK_DETAIL_STAGES.has(detail) || detail === "past") return "any";
  return detail;
}

export function countTripAdvancedFilters(filters: TripAdvancedFilters): number {
  let count = 0;
  if (filters.stage !== "any") count += 1;
  if (filters.client_tier !== "any") count += 1;
  if (filters.price !== "any") count += 1;
  if (filters.quote !== "any") count += 1;
  if (filters.payment !== "any") count += 1;
  if (filters.owner !== "any") count += 1;
  if (filters.starts_from || filters.starts_to) count += 1;
  return count;
}
