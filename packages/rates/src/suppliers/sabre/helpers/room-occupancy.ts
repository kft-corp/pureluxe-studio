/**
 * Per-room guest counts for Sabre Avail / Details.
 *
 * Sabre CSL multi-room (ERR.5029): every Room must have the same Adults and
 * Children counts. ChildAges may differ per room. Never invent uneven family
 * splits into one multi-room payload.
 */

export type RoomOccupancy = {
  adults: number;
  children?: number;
  /** Ages in years for children in this room only (may differ per room). */
  childAges?: number[];
};

export function needsRoomOccupancySplit(
  rooms: number,
  children: number,
): boolean {
  return Math.max(1, Math.floor(rooms || 1)) > 1 && Math.max(0, Math.floor(children || 0)) > 0;
}

/** True when every room has the same Adults and Children counts (Sabre multi-room rule). */
export function hasUniformSabrePax(rooms: RoomOccupancy[]): boolean {
  if (rooms.length <= 1) return true;
  const first = rooms[0]!;
  const adults = Math.max(1, Math.floor(first.adults || 1));
  const children = Math.max(0, Math.floor(first.children ?? 0));
  return rooms.every((row) => {
    const a = Math.max(1, Math.floor(row.adults || 1));
    const c = Math.max(0, Math.floor(row.children ?? 0));
    return a === adults && c === children;
  });
}

/**
 * Build a Sabre-valid matching split when adults and children divide evenly
 * across rooms (each room ≥1 adult). Ages are distributed one-per-child across rooms.
 */
export function buildMatchingRoomOccupancies(input: {
  rooms: number;
  adults: number;
  children: number;
  childAges?: number[];
}): RoomOccupancy[] | null {
  const roomCount = Math.max(1, Math.floor(input.rooms));
  const adultTotal = Math.max(1, Math.floor(input.adults));
  const childTotal = Math.max(0, Math.floor(input.children));
  if (roomCount <= 1) {
    return [
      {
        adults: adultTotal,
        children: childTotal,
        childAges: input.childAges,
      },
    ];
  }
  if (adultTotal % roomCount !== 0) return null;
  if (childTotal % roomCount !== 0) return null;
  const adultsPer = adultTotal / roomCount;
  const childrenPer = childTotal / roomCount;
  if (adultsPer < 1) return null;

  const ages = (input.childAges ?? []).map((a) => Math.floor(a));
  const ageQueue = [...ages];
  return Array.from({ length: roomCount }, () => {
    const roomAges: number[] = [];
    for (let i = 0; i < childrenPer; i += 1) {
      roomAges.push(ageQueue.shift() ?? 8);
    }
    return {
      adults: adultsPer,
      children: childrenPer,
      ...(childrenPer > 0 ? { childAges: roomAges } : {}),
    };
  });
}

/**
 * Adults-only multi-room: same adult count on every room (Sabre).
 * Adults must divide evenly; each room ≥1 adult.
 */
export function distributeAdultsAcrossRooms(
  adults: number,
  rooms: number,
): RoomOccupancy[] {
  const roomCount = Math.max(1, Math.floor(rooms));
  const adultCount = Math.max(1, Math.floor(adults));
  if (adultCount < roomCount) {
    throw new Error("Each room needs at least one adult");
  }
  if (adultCount % roomCount !== 0) {
    throw new Error("SABRE_UNIFORM_PAX_REQUIRED");
  }
  const per = adultCount / roomCount;
  return Array.from({ length: roomCount }, () => ({
    adults: per,
    children: 0,
  }));
}

/** One Sabre shop: rooms that share the same Adults + Children counts. */
export type SabreOccupancyShopGroup = {
  adults: number;
  children: number;
  rooms: number;
  occupancies: RoomOccupancy[];
  /** 1-based room indexes from the advisor split. */
  roomIndexes: number[];
};

function sabrePaxKey(row: RoomOccupancy): string {
  const adults = Math.max(1, Math.floor(row.adults || 1));
  const children = Math.max(0, Math.floor(row.children ?? 0));
  return `${adults}|${children}`;
}

/**
 * Split a (possibly uneven) per-room layout into Sabre-valid shops.
 * Same Adults/Children counts share one multi-room request (ChildAges may differ).
 * Uneven counts → separate shops that Studio merges after search.
 */
export function groupRoomOccupanciesForSabreShops(
  rooms: RoomOccupancy[],
): SabreOccupancyShopGroup[] {
  const buckets = new Map<
    string,
    {
      adults: number;
      children: number;
      occupancies: RoomOccupancy[];
      roomIndexes: number[];
    }
  >();

  rooms.forEach((row, index) => {
    const adults = Math.max(1, Math.floor(row.adults || 1));
    const children = Math.max(0, Math.floor(row.children ?? 0));
    const key = sabrePaxKey(row);
    const existing = buckets.get(key);
    const occupancy: RoomOccupancy = {
      adults,
      children,
      ...(children > 0 && row.childAges && row.childAges.length > 0
        ? { childAges: row.childAges.map((a) => Math.floor(a)) }
        : {}),
    };
    if (existing) {
      existing.occupancies.push(occupancy);
      existing.roomIndexes.push(index + 1);
      return;
    }
    buckets.set(key, {
      adults,
      children,
      occupancies: [occupancy],
      roomIndexes: [index + 1],
    });
  });

  return [...buckets.values()].map((bucket) => ({
    adults: bucket.adults,
    children: bucket.children,
    rooms: bucket.occupancies.length,
    occupancies: bucket.occupancies,
    roomIndexes: bucket.roomIndexes,
  }));
}

/** Party label for a Sabre shop group (advisor-facing, no jargon). */
export function formatOccupancyShopLabel(group: SabreOccupancyShopGroup): string {
  const adults =
    group.rooms === 1
      ? `${group.adults} adult${group.adults === 1 ? "" : "s"}`
      : `${group.rooms}× ${group.adults} adult${group.adults === 1 ? "" : "s"}`;
  if (group.children <= 0) return adults;
  const childWord = group.children === 1 ? "child" : "children";
  if (group.rooms === 1) return `${adults} + ${group.children} ${childWord}`;
  return `${adults} + ${group.children} ${childWord} each`;
}

export type RoomOccupancyValidation =
  | { ok: true; rooms: RoomOccupancy[] }
  | { ok: false; reason: string; code?: "split_required" | "uneven_pax" | "invalid" };

/**
 * Validate advisor-stated per-room split against trip totals.
 * Each room ≥1 adult; sums match party.
 * When requireUniformPax (live Sabre), Adults/Children counts must match across rooms.
 */
export function validateRoomOccupancies(input: {
  rooms: number;
  adults: number;
  children: number;
  childAges?: number[];
  roomOccupancies: RoomOccupancy[];
  /** Default true for Sabre. Set false for contracted-only shops that allow mixed layouts. */
  requireUniformPax?: boolean;
}): RoomOccupancyValidation {
  const roomCount = Math.max(1, Math.floor(input.rooms));
  const adultTotal = Math.max(1, Math.floor(input.adults));
  const childTotal = Math.max(0, Math.floor(input.children));
  const list = input.roomOccupancies ?? [];

  if (list.length !== roomCount) {
    return {
      ok: false,
      code: "invalid",
      reason: `Need occupancy for each of the ${roomCount} rooms (got ${list.length}).`,
    };
  }

  let adultsSum = 0;
  let childrenSum = 0;
  const normalized: RoomOccupancy[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const row = list[i]!;
    const adults = Math.max(0, Math.floor(row.adults || 0));
    const children = Math.max(0, Math.floor(row.children ?? 0));
    if (adults < 1) {
      return {
        ok: false,
        code: "invalid",
        reason: `Room ${i + 1} needs at least one adult.`,
      };
    }
    if (adults + children > 9) {
      return {
        ok: false,
        code: "invalid",
        reason: `Room ${i + 1} cannot have more than 9 guests (Sabre limit).`,
      };
    }
    if (children > 0) {
      const ages = (row.childAges ?? []).map((a) => Math.floor(a));
      if (ages.length > 0 && ages.length !== children) {
        return {
          ok: false,
          code: "invalid",
          reason: `Room ${i + 1}: give one age per child (${children} children).`,
        };
      }
      normalized.push({
        adults,
        children,
        childAges: ages.length > 0 ? ages : undefined,
      });
    } else {
      normalized.push({ adults, children: 0 });
    }
    adultsSum += adults;
    childrenSum += children;
  }

  if (adultsSum !== adultTotal) {
    return {
      ok: false,
      code: "invalid",
      reason: `Adults across rooms (${adultsSum}) must equal the party (${adultTotal}).`,
    };
  }
  if (childrenSum !== childTotal) {
    return {
      ok: false,
      code: "invalid",
      reason: `Children across rooms (${childrenSum}) must equal the party (${childTotal}).`,
    };
  }

  const requireUniform = input.requireUniformPax !== false;
  if (requireUniform && roomCount > 1 && !hasUniformSabrePax(normalized)) {
    return {
      ok: false,
      code: "uneven_pax",
      reason:
        "This path needs the same adults and children count in every room. " +
        "Pass the mixed layout for a multi-shop merge, or use a matching split / paste quote.",
    };
  }

  // Fill missing per-room ages from global ages when counts match (ages may differ per room).
  if (childTotal > 0 && input.childAges && input.childAges.length === childTotal) {
    const ageQueue = input.childAges.map((a) => Math.floor(a));
    const withAges = normalized.map((row) => {
      const children = row.children ?? 0;
      if (children <= 0) return row;
      if (row.childAges && row.childAges.length === children) return row;
      const roomAges: number[] = [];
      for (let i = 0; i < children; i += 1) {
        roomAges.push(ageQueue.shift() ?? 8);
      }
      return { ...row, childAges: roomAges };
    });
    return { ok: true, rooms: withAges };
  }

  return { ok: true, rooms: normalized };
}
