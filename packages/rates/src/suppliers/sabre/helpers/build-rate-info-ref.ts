import {
  distributeAdultsAcrossRooms,
  hasUniformSabrePax,
  needsRoomOccupancySplit,
  type RoomOccupancy,
} from "./room-occupancy";

/** Stay / party fields shared by Sabre hotel rate shop calls. */
export type SearchHotelRatesStay = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  /** Ages in years; sent as comma-separated string when children > 0. */
  childAges?: number[];
  rooms?: number;
  /**
   * Explicit guests per room. Required when rooms > 1 and children > 0.
   * Never invent a family split — Trip Builder asks the advisor first.
   */
  roomOccupancies?: RoomOccupancy[];
  currency?: string;
  /** Rate plan / negotiated program codes (Stage 3). */
  ratePlanCodes?: string[];
  bestOnly?: string;
  pageSize?: number;
};

function sabreRoomFromOccupancy(
  occupancy: RoomOccupancy,
  index: number,
): Record<string, unknown> {
  const adults = Math.max(1, Math.floor(occupancy.adults || 1));
  const children = Math.max(0, Math.floor(occupancy.children ?? 0));
  const room: Record<string, unknown> = {
    Index: index,
    Adults: adults,
    Children: children,
  };
  if (children > 0) {
    const ages =
      occupancy.childAges && occupancy.childAges.length > 0
        ? occupancy.childAges.map((a) => String(Math.floor(a))).join(",")
        : Array.from({ length: children }, () => "8").join(",");
    room.ChildAges = ages;
  }
  return room;
}

function resolveRoomOccupancies(input: SearchHotelRatesStay): RoomOccupancy[] {
  const adults = Math.max(1, Math.floor(input.adults || 1));
  const children = Math.max(0, Math.floor(input.children ?? 0));
  const roomCount = Math.max(1, Math.floor(input.rooms ?? 1));
  const explicit = input.roomOccupancies;

  if (explicit && explicit.length > 0) {
    // Single Sabre request cannot mix Adults/Children counts (ERR.5029).
    // Adapter dual-shops uneven layouts before calling this builder.
    if (explicit.length > 1 && !hasUniformSabrePax(explicit)) {
      throw new Error("ROOM_OCCUPANCY_UNEVEN_SABRE");
    }
    return explicit;
  }

  if (needsRoomOccupancySplit(roomCount, children)) {
    throw new Error("ROOM_OCCUPANCY_SPLIT_REQUIRED");
  }

  if (roomCount > 1) {
    // Adults only: even split (each room ≥1 adult). Never clone full party per room.
    return distributeAdultsAcrossRooms(adults, roomCount);
  }

  return [
    {
      adults,
      children,
      childAges: input.childAges,
    },
  ];
}

/** Shared stay / party → Sabre RateInfoRef + Rooms (Avail + Details). */
export function buildRateInfoRef(
  input: SearchHotelRatesStay,
  options?: { includeBestOnly?: boolean },
): Record<string, unknown> {
  const occupancies = resolveRoomOccupancies(input);

  const rateInfoRef: Record<string, unknown> = {
    CurrencyCode: (input.currency ?? "USD").toUpperCase(),
    PrepaidQualifier: "IncludePrepaid",
    ConvertedRateInfoOnly: true,
    StayDateTimeRange: {
      StartDate: input.checkIn,
      EndDate: input.checkOut,
    },
    Rooms: {
      Room: occupancies.map((row, i) => sabreRoomFromOccupancy(row, i + 1)),
    },
  };

  if (options?.includeBestOnly !== false) {
    rateInfoRef.BestOnly = input.bestOnly ?? "4";
  }

  const ratePlanCodes = (input.ratePlanCodes ?? [])
    .map((c) => c.trim())
    .filter(Boolean);
  if (ratePlanCodes.length > 0) {
    rateInfoRef.RatePlanCandidates = {
      ExactMatchOnly: false,
      RatePlanCandidate: ratePlanCodes.map((RatePlanCode) => ({
        RatePlanCode,
      })),
    };
  }

  return rateInfoRef;
}
