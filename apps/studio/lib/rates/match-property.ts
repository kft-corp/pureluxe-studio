import {
  findActivePropertyById,
  searchActivePropertiesByName,
  searchPropertiesRanked,
  type Property,
} from "@pureluxe/db";

export type PropertyNameMatch = {
  status: "linked" | "none" | "several";
  names: string[];
  property: Property | null;
};

const LINKED_SCORE = 0.7;
const UNSURE_SCORE = 0.35;
const SCORE_GAP = 0.15;

const STOP = new Set([
  "change",
  "chnage",
  "checkout",
  "checkin",
  "from",
  "update",
  "hotel",
  "stay",
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "date",
  "dates",
  "city",
  "adults",
  "adult",
  "children",
  "child",
  "rooms",
  "room",
]);

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when two hotel labels are the same stay, allowing a longer official name. */
export function namesLooselyMatch(left: string, right: string): boolean {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function pickMatch(query: string, rows: Property[]): PropertyNameMatch {
  if (rows.length === 0) return { status: "none", names: [], property: null };

  const needle = normalizeName(query);
  const exact = rows.filter((row) => normalizeName(row.name) === needle);
  if (exact.length === 1) {
    return { status: "linked", names: [exact[0].name], property: exact[0] };
  }
  if (exact.length > 1) {
    return {
      status: "several",
      names: exact.map((row) => row.name),
      property: null,
    };
  }

  const contained = rows.filter((row) => namesLooselyMatch(row.name, query));
  if (contained.length === 1) {
    return {
      status: "linked",
      names: [contained[0].name],
      property: contained[0],
    };
  }
  if (rows.length === 1) {
    return { status: "linked", names: [rows[0].name], property: rows[0] };
  }

  return {
    status: "several",
    names: rows.slice(0, 5).map((row) => row.name),
    property: null,
  };
}

/**
 * Match a typed hotel to one active property (aliases + fuzzy score).
 * One clear name links. Several close matches stay unlinked so the advisor can choose.
 */
export async function matchPropertyByName(
  name: string,
): Promise<PropertyNameMatch> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { status: "none", names: [], property: null };
  }

  try {
    const ranked = await searchPropertiesRanked({ query: trimmed, limit: 5 });
    if (ranked.length > 0) {
      const top = ranked[0]!;
      const second = ranked[1];
      const clear =
        top.score >= LINKED_SCORE &&
        (!second || top.score - second.score >= SCORE_GAP || top.score >= 0.95);

      if (clear) {
        const property = await findActivePropertyById(top.id);
        if (property) {
          return { status: "linked", names: [property.name], property };
        }
      }

      if (top.score >= UNSURE_SCORE) {
        return {
          status: "several",
          names: ranked.filter((h) => h.score >= UNSURE_SCORE).map((h) => h.name),
          property: null,
        };
      }
    }
  } catch {
    // Fall back to ilike search when the ranked RPC is not available yet.
  }

  const direct = await searchActivePropertiesByName(trimmed);
  const picked = pickMatch(trimmed, direct);
  if (picked.status !== "none") return picked;

  const token = normalizeName(trimmed)
    .split(" ")
    .filter((word) => word.length >= 5 && !STOP.has(word))
    .sort((a, b) => b.length - a.length)[0];

  if (!token || token === normalizeName(trimmed)) {
    return { status: "none", names: [], property: null };
  }

  return pickMatch(trimmed, await searchActivePropertiesByName(token));
}
