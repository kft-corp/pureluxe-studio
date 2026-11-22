import type { RawRateInput } from "../../../results";
import type { RateSourceCode } from "../../../types";
import { asArray, asRecord, asString } from "../helpers";
import {
  extractHotelAdvisorFacts,
  extractPricedRateRows,
  mapRateInfosToQuotes,
} from "./rate-fields";

export type MapHotelRatesToQuotesInput = {
  response: unknown;
  source: Extract<RateSourceCode, "gds_public" | "gds_negotiated">;
  propertyId?: string | null;
  checkIn: string;
  checkOut: string;
  currency?: string;
};

/**
 * Map Sabre GetHotelAvailRS → RawRateInput[].
 * Prefers Rooms.Room → RatePlans (room name, cancel, payment); falls back to thin RateInfos.
 */
export function mapHotelRatesToQuotes(
  input: MapHotelRatesToQuotesInput,
): RawRateInput[] {
  const root = asRecord(input.response);
  const rs = asRecord(root?.GetHotelAvailRS) ?? root;
  if (!rs) return [];

  const availInfos = asRecord(rs.HotelAvailInfos);
  const hotels = asArray(availInfos?.HotelAvailInfo ?? rs.HotelAvailInfo);
  const quotes: RawRateInput[] = [];

  for (const hotelRow of hotels) {
    const hotel = asRecord(hotelRow);
    if (!hotel) continue;

    const hotelInfo = asRecord(hotel.HotelInfo) ?? {};
    const hotelCode = asString(hotelInfo.HotelCode);
    const hotelName = asString(hotelInfo.HotelName);

    quotes.push(
      ...mapRateInfosToQuotes({
        source: input.source,
        propertyId: input.propertyId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        currency: input.currency,
        hotelCode,
        hotelName,
        rates: extractPricedRateRows(hotel),
        shopStep: "avail",
        hotelFacts: extractHotelAdvisorFacts(hotelInfo),
      }),
    );
  }

  return quotes;
}
