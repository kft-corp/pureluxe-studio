import type { RawRateInput } from "../../../results";
import {
  formatOccupancyShopLabel,
  type SabreOccupancyShopGroup,
} from "./room-occupancy";

/** Top picks per occupancy shop before cartesian merge. */
const MAX_PICKS_PER_GROUP = 3;
/** Cap combined stay options after merge. */
const MAX_MERGED_QUOTES = 12;

function quoteCost(quote: RawRateInput): number {
  return typeof quote.cost_internal === "number" &&
    Number.isFinite(quote.cost_internal)
    ? quote.cost_internal
    : Number.POSITIVE_INFINITY;
}

function pickTopQuotes(quotes: RawRateInput[], limit: number): RawRateInput[] {
  return quotes
    .slice()
    .filter(
      (quote) =>
        typeof quote.cost_internal === "number" &&
        Number.isFinite(quote.cost_internal) &&
        quote.cost_internal > 0,
    )
    .sort((a, b) => quoteCost(a) - quoteCost(b))
    .slice(0, Math.max(1, limit));
}

function joinUnique(parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.length > 0 ? out.join(" · ") : null;
}

function occupancyGuestLabel(group: SabreOccupancyShopGroup): string {
  const a = `${group.adults}A`;
  const c = group.children > 0 ? `+${group.children}C` : "";
  if (group.rooms === 1) return `${a}${c}`;
  return `${group.rooms}×${a}${c}`;
}

function roomNameForSegment(
  quote: RawRateInput,
  group: SabreOccupancyShopGroup,
): string {
  const room = quote.room_name?.trim() || "Room";
  return `${room} (${occupancyGuestLabel(group)})`;
}

type SegmentPick = {
  group: SabreOccupancyShopGroup;
  quote: RawRateInput;
};

function cartesianSegments(
  groups: Array<{ group: SabreOccupancyShopGroup; quotes: RawRateInput[] }>,
): SegmentPick[][] {
  let combos: SegmentPick[][] = [[]];
  for (const row of groups) {
    const picks = pickTopQuotes(row.quotes, MAX_PICKS_PER_GROUP);
    if (picks.length === 0) return [];
    const next: SegmentPick[][] = [];
    for (const prefix of combos) {
      for (const quote of picks) {
        next.push([...prefix, { group: row.group, quote }]);
      }
    }
    combos = next;
  }
  return combos;
}

function mergeOneCombo(segments: SegmentPick[]): RawRateInput {
  const first = segments[0]!.quote;
  const cost = segments.reduce((sum, row) => sum + quoteCost(row.quote), 0);
  const roomName = segments
    .map((row) => roomNameForSegment(row.quote, row.group))
    .join(" + ");
  const board = joinUnique(segments.map((row) => row.quote.board));
  const cancellation = joinUnique(
    segments.map((row) => row.quote.cancellation_summary),
  );
  const payment = joinUnique(segments.map((row) => row.quote.payment_summary));
  const inclusions = [
    ...new Set(
      segments.flatMap((row) =>
        Array.isArray(row.quote.inclusions)
          ? row.quote.inclusions.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      ),
    ),
  ];

  const occupancyPerRoom = segments.map(
    (row) =>
      Math.max(1, row.group.adults) + Math.max(0, row.group.children),
  );
  const maxOccupancyPerRoom = segments.map((row) => {
    const max = row.quote.raw?.max_occupancy;
    return typeof max === "number" && Number.isFinite(max) && max >= 1
      ? Math.floor(max)
      : null;
  });

  const segmentRaw = segments.map((row, index) => ({
    room_indexes: row.group.roomIndexes,
    adults: row.group.adults,
    children: row.group.children,
    rooms: row.group.rooms,
    guests: occupancyPerRoom[index],
    max_occupancy: maxOccupancyPerRoom[index],
    label: formatOccupancyShopLabel(row.group),
    room_name: row.quote.room_name ?? null,
    cost_internal: quoteCost(row.quote),
    rate_key:
      typeof row.quote.raw?.rate_key === "string"
        ? row.quote.raw.rate_key
        : null,
    rate_plan_code:
      typeof row.quote.raw?.rate_plan_code === "string"
        ? row.quote.raw.rate_plan_code
        : null,
    cancellation_summary: row.quote.cancellation_summary ?? null,
    board: row.quote.board ?? null,
    payment_summary: row.quote.payment_summary ?? null,
    bed_type:
      typeof row.quote.raw?.bed_type === "string"
        ? row.quote.raw.bed_type
        : null,
    payment_timing:
      typeof row.quote.raw?.payment_timing === "string"
        ? row.quote.raw.payment_timing
        : null,
  }));

  return {
    property_id: first.property_id ?? null,
    property_name: first.property_name ?? null,
    room_name: roomName,
    board,
    check_in: first.check_in,
    check_out: first.check_out,
    currency: first.currency,
    cost_internal: cost,
    rate_source_code: first.rate_source_code,
    inclusions,
    cancellation_summary: cancellation,
    payment_summary: payment,
    availability_status: "available",
    raw: {
      ...(first.raw ?? {}),
      rate_key: null,
      // Clear single-room max so the table shows per-room Occupancy 2 / 1.
      max_occupancy: null,
      sabre_multi_occupancy: true,
      occupancy_per_room: occupancyPerRoom,
      max_occupancy_per_room: maxOccupancyPerRoom,
      sabre_occupancy_segments: segmentRaw,
      average_nightly_rate: null,
    },
  };
}

export type MergeOccupancyShopResult =
  | {
      ok: true;
      quotes: RawRateInput[];
      groupCount: number;
    }
  | {
      ok: false;
      emptyLabels: string[];
    };

/**
 * Merge Sabre quotes from separate uniform-pax shops into combined stay options.
 * Each combo keeps per-room segment metadata for later book (separate segments).
 */
export function mergeSabreOccupancyShopQuotes(
  groups: Array<{ group: SabreOccupancyShopGroup; quotes: RawRateInput[] }>,
): MergeOccupancyShopResult {
  const emptyLabels = groups
    .filter((row) => row.quotes.length === 0)
    .map((row) => formatOccupancyShopLabel(row.group));
  if (emptyLabels.length > 0) {
    return { ok: false, emptyLabels };
  }

  if (groups.length <= 1) {
    return {
      ok: true,
      quotes: groups[0]?.quotes ?? [],
      groupCount: groups.length,
    };
  }

  const combos = cartesianSegments(groups);
  const merged = combos
    .map(mergeOneCombo)
    .sort((a, b) => quoteCost(a) - quoteCost(b))
    .slice(0, MAX_MERGED_QUOTES);

  return {
    ok: true,
    quotes: merged,
    groupCount: groups.length,
  };
}
