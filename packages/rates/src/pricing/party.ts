/** Default age when children travel but ages are not on file (Fix 8). */
export const ASSUMED_CHILD_AGE = 8;

export type PartyRoom = {
  adults: number;
  children: number;
  child_ages: number[];
};

/**
 * Split adults and children across rooms as evenly as possible (R12).
 * Children keep their ages in the same order, round-robin into rooms.
 */
export function splitPartyAcrossRooms(input: {
  adults: number;
  children: number;
  rooms: number;
  child_ages?: number[] | null;
}): { rooms: PartyRoom[]; child_ages_assumed: boolean } {
  const roomCount = Math.max(1, Math.floor(input.rooms) || 1);
  const adults = Math.max(0, Math.floor(input.adults) || 0);
  const children = Math.max(0, Math.floor(input.children) || 0);

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
    child_ages: [],
  }));

  for (let i = 0; i < adults; i++) {
    rooms[i % roomCount]!.adults += 1;
  }
  for (let i = 0; i < children; i++) {
    const room = rooms[i % roomCount]!;
    room.children += 1;
    room.child_ages.push(ages[i]!);
  }

  return { rooms, child_ages_assumed };
}

/**
 * Whether one room allocation fits a rate's occupancy limits.
 * Null max = no hard cap beyond what extras can cover.
 */
export function roomFitsOccupancy(
  rate: {
    max_adults: number | null;
    max_children: number | null;
    base_adults: number;
    base_children: number;
  },
  room: PartyRoom,
): boolean {
  if (rate.max_adults != null && room.adults > rate.max_adults) return false;
  if (rate.max_children != null && room.children > rate.max_children) return false;
  return true;
}

/** Every split room must fit; otherwise the category is hidden for this party. */
export function partyFitsRate(
  rate: {
    max_adults: number | null;
    max_children: number | null;
    base_adults: number;
    base_children: number;
  },
  rooms: PartyRoom[],
): boolean {
  return rooms.every((room) => roomFitsOccupancy(rate, room));
}
