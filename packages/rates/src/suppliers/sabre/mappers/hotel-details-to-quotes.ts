import type { RawRateInput } from "../../../results";
import type { RateSourceCode } from "../../../types";
import { asRecord, asString } from "../helpers";
import {
  extractHotelAdvisorFacts,
  extractPricedRateRows,
  mapRateInfosToQuotes,
} from "./rate-fields";

export type MapHotelDetailsToQuotesInput = {
  response: unknown;
  source: Extract<RateSourceCode, "gds_public" | "gds_negotiated">;
  propertyId?: string | null;
  checkIn: string;
  checkOut: string;
  currency?: string;
  /** Fallback when Details omits HotelInfo.HotelCode. */
  hotelCode?: string | null;
};

/**
 * Map Sabre GetHotelDetailsRS → RawRateInput[].
 * Same Rooms → RatePlans extraction as Avail for advisor-usable rows.
 */
export function mapHotelDetailsToQuotes(
  input: MapHotelDetailsToQuotesInput,
): RawRateInput[] {
  const root = asRecord(input.response);
  const rs = asRecord(root?.GetHotelDetailsRS) ?? root;
  if (!rs) return [];

  const details = asRecord(rs.HotelDetailsInfo) ?? rs;
  const hotelInfo = asRecord(details.HotelInfo) ?? {};
  const descriptiveInfo = asRecord(details.HotelDescriptiveInfo);
  const hotelCode =
    asString(hotelInfo.HotelCode) ?? input.hotelCode ?? null;
  const hotelName = asString(hotelInfo.HotelName);

  return mapRateInfosToQuotes({
    source: input.source,
    propertyId: input.propertyId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    currency: input.currency,
    hotelCode,
    hotelName,
    rates: extractPricedRateRows(details),
    shopStep: "details",
    hotelFacts: extractHotelAdvisorFacts(hotelInfo, descriptiveInfo),
  });
}
