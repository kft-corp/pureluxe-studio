import type { RateSourcesSetting } from "@pureluxe/db";

import type { NormalizedRateOption, RoutingPattern } from "../types";

const AVAILABILITY_RANK: Record<
  NormalizedRateOption["availability_status"],
  number
> = {
  available: 0,
  on_request: 1,
  unknown: 2,
  unavailable: 3,
};

function sameOption(a: NormalizedRateOption, b: NormalizedRateOption): boolean {
  return (
    a.rate_source_code === b.rate_source_code &&
    a.cost_internal === b.cost_internal &&
    a.property_id === b.property_id &&
    a.room_name === b.room_name &&
    a.check_in === b.check_in
  );
}

function propertyKey(option: NormalizedRateOption): string {
  return option.property_id ?? option.property_name ?? "__unknown__";
}

function isGds(option: NormalizedRateOption): boolean {
  return (
    option.rate_source_code === "gds_public" ||
    option.rate_source_code === "gds_negotiated"
  );
}

/** Dual GDS winner for one property (undercut % then cheaper_of). */
function pickGdsWinner(
  group: NormalizedRateOption[],
  setting: RateSourcesSetting,
): NormalizedRateOption | null {
  const pub = group.find((o) => o.rate_source_code === "gds_public");
  const neg = group.find((o) => o.rate_source_code === "gds_negotiated");
  if (!pub && !neg) return null;
  if (!pub) return neg ?? null;
  if (!neg) return pub;

  const ratio = setting.gds_undercut_pct / 100;
  if (neg.cost_internal <= pub.cost_internal * (1 - ratio)) return neg;
  if (pub.cost_internal <= neg.cost_internal * (1 - ratio)) return pub;
  return neg.cost_internal <= pub.cost_internal ? neg : pub;
}

/** Keep GDS winners; keep negotiated when always_surface; keep all non-GDS. */
function filterForDisplay(
  options: NormalizedRateOption[],
  setting: RateSourcesSetting,
): { list: NormalizedRateOption[]; gdsWinners: NormalizedRateOption[] } {
  const byProperty = new Map<string, NormalizedRateOption[]>();
  for (const option of options) {
    const key = propertyKey(option);
    const list = byProperty.get(key) ?? [];
    list.push(option);
    byProperty.set(key, list);
  }

  const list: NormalizedRateOption[] = [];
  const gdsWinners: NormalizedRateOption[] = [];

  for (const [, group] of byProperty) {
    const winner = pickGdsWinner(group, setting);
    if (winner) gdsWinners.push(winner);

    for (const option of group) {
      if (!isGds(option)) {
        list.push(option);
        continue;
      }
      if (winner && sameOption(option, winner)) {
        list.push(option);
        continue;
      }
      if (
        setting.always_surface_negotiated_gds &&
        option.rate_source_code === "gds_negotiated"
      ) {
        list.push(option);
        continue;
      }
      if (option.rate_source_code === "gds_public") {
        list.push(option);
      }
    }
  }

  return { list, gdsWinners };
}

function patternBoost(
  option: NormalizedRateOption,
  pattern: RoutingPattern,
): number {
  switch (pattern) {
    case "wholesale_first":
      return option.rate_source_code === "wholesale" ? 0 : 1;
    case "gds_first":
    case "gds_then_offline_at_peak":
      return isGds(option) ? 0 : 1;
    case "offline_only":
      return option.rate_source_code.startsWith("offline_") ? 0 : 1;
    default:
      return 0;
  }
}

function pickRecommended(
  pool: NormalizedRateOption[],
  pattern: RoutingPattern,
  gdsWinners: NormalizedRateOption[],
): NormalizedRateOption {
  if (pattern === "wholesale_first") {
    const wholesale = pool.find((o) => o.rate_source_code === "wholesale");
    if (wholesale) return wholesale;
  }

  if (pattern === "gds_first" || pattern === "gds_then_offline_at_peak") {
    const fromWinners = pool.filter((o) =>
      gdsWinners.some((w) => sameOption(w, o)),
    );
    const gdsPool =
      fromWinners.length > 0 ? fromWinners : pool.filter(isGds);
    if (gdsPool.length > 0) {
      return gdsPool.reduce((best, cur) =>
        cur.cost_internal < best.cost_internal ? cur : best,
      );
    }
  }

  return pool.reduce((best, cur) =>
    cur.cost_internal < best.cost_internal ? cur : best,
  );
}

/**
 * Sort by pattern preference, availability, cost; mark one `recommended`.
 * Dual-GDS undercut is per property.
 */
export function rankAndRecommend(
  options: NormalizedRateOption[],
  setting: RateSourcesSetting,
  pattern: RoutingPattern,
): NormalizedRateOption[] {
  if (options.length === 0) return [];

  const { list, gdsWinners } = filterForDisplay(options, setting);

  const sorted = [...list].sort((a, b) => {
    const byPattern = patternBoost(a, pattern) - patternBoost(b, pattern);
    if (byPattern !== 0) return byPattern;

    const byAvail =
      AVAILABILITY_RANK[a.availability_status] -
      AVAILABILITY_RANK[b.availability_status];
    if (byAvail !== 0) return byAvail;

    return a.cost_internal - b.cost_internal;
  });

  const usable = sorted.filter((o) => o.availability_status !== "unavailable");
  const pool = usable.length > 0 ? usable : sorted;
  const winner = pickRecommended(pool, pattern, gdsWinners);

  return sorted.map((option) => ({
    ...option,
    recommended: sameOption(option, winner),
  }));
}
