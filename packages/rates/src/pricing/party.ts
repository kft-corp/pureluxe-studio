/** Default age when children travel but ages are not on file (Fix 8). */
export const ASSUMED_CHILD_AGE = 8;

export type PartyRoom = {
  adults: number;
  /** Non-infant children (typically age 2+). */
  children: number;
  child_ages: number[];
  /** Under-2 guests — excluded from max_children / max_occupancy. */
  infants?: number;
};

export type OccupancyLimits = {
  max_adults: number | null;
  max_children: number | null;
  max_occupancy?: number | null;
  base_adults: number;
  base_children: number;
};

/** True when neither adult nor child max is set — treat as unknown, not unlimited. */
export function occupancyLimitsUnknown(rate: OccupancyLimits): boolean {
  return rate.max_adults == null && rate.max_children == null;
}

/**
 * Use advisor-confirmed per-room guests when present (matching or mixed layouts).
 * Falls back to even split when omitted.
 */
export function partyRoomsFromOccupancies(
  occupancies: Array<{
    adults: number;
    children?: number;
    child_ages?: number[] | null;
    infants?: number;
  }>,
): { rooms: PartyRoom[]; child_ages_assumed: boolean } {
  let child_ages_assumed = false;
  const rooms: PartyRoom[] = occupancies.map((row) => {
    const adults = Math.max(0, Math.floor(row.adults || 0));
    const infants = Math.max(0, Math.floor(row.infants ?? 0));
    const children = Math.max(0, Math.floor(row.children ?? 0));
    const provided = (row.child_ages ?? [])
      .map((age) => Math.floor(age))
      .filter((age) => Number.isFinite(age) && age >= 0);
    const child_ages: number[] = [];
    for (let i = 0; i < children; i += 1) {
      if (provided[i] != null) {
        child_ages.push(provided[i]!);
      } else {
        child_ages.push(ASSUMED_CHILD_AGE);
        child_ages_assumed = true;
      }
    }
    return {
      adults,
      children,
      child_ages,
      ...(infants > 0 ? { infants } : {}),
    };
  });
  return { rooms, child_ages_assumed };
}

export function splitPartyAcrossRooms(input: {
  adults: number;
  children: number;
  rooms: number;
  child_ages?: number[] | null;
  infants?: number;
}): { rooms: PartyRoom[]; child_ages_assumed: boolean } {
  const roomCount = Math.max(1, Math.floor(input.rooms) || 1);
  const adults = Math.max(0, Math.floor(input.adults) || 0);
  const children = Math.max(0, Math.floor(input.children) || 0);
  const infants = Math.max(0, Math.floor(input.infants ?? 0));

  const provided = (input.child_ages ?? [])
    .map((age) => Math.floor(age))
    .filter((age) => Number.isFinite(age) && age >= 0);

  let child_ages_assumed = false;
  const ages: number[] = [];
  for (let i = 0; i < children; i++) {
    if (provided[i] != null) {
      ages.push(provided[i]!);
    } else {
      ages.push(ASSUMED_CHILD_AGE);
      child_ages_assumed = true;
    }
  }

  const rooms: PartyRoom[] = Array.from({ length: roomCount }, () => ({
    adults: 0,
    children: 0,
    child_ages: [] as number[],
    infants: 0,
  }));

  for (let i = 0; i < adults; i++) {
    rooms[i % roomCount]!.adults += 1;
  }
  for (let i = 0; i < children; i++) {
    const room = rooms[i % roomCount]!;
    room.children += 1;
    room.child_ages.push(ages[i]!);
  }
  for (let i = 0; i < infants; i++) {
    rooms[i % roomCount]!.infants = (rooms[i % roomCount]!.infants ?? 0) + 1;
  }

  return {
    rooms: rooms.map((room) => ({
      adults: room.adults,
      children: room.children,
      child_ages: room.child_ages,
      ...((room.infants ?? 0) > 0 ? { infants: room.infants } : {}),
    })),
    child_ages_assumed,
  };
}

/**
 * Whether one room allocation fits a rate's occupancy limits.
 * Infants do not count toward max_children or max_occupancy.
 */
export function roomFitsOccupancy(
  rate: OccupancyLimits,
  room: PartyRoom,
): boolean {
  if (rate.max_adults != null && room.adults > rate.max_adults) return false;
  if (rate.max_children != null && room.children > rate.max_children) return false;
  const total = room.adults + room.children;
  if (rate.max_occupancy != null && total > rate.max_occupancy) return false;
  return true;
}

/** Every split room must fit; otherwise the category is hidden for this party. */
export function partyFitsRate(
  rate: OccupancyLimits,
  rooms: PartyRoom[],
): boolean {
  return rooms.every((room) => roomFitsOccupancy(rate, room));
}
