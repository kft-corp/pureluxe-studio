import type { RawRateInput } from "../../../results";
import type { RateSourceCode } from "../../../types";
import { asArray, asNumber, asRecord, asString } from "../helpers";
import {
  extractHotelAdvisorFacts,
  extractPricedRateRows,
  mapRateInfosToQuotes,
} from "./rate-fields";

/** Hotel-level RateRanges often hold supplier currency (e.g. JPY) when room rows are converted USD. */
function rateRangeSupplierCurrency(
  hotelRateInfo: Record<string, unknown> | null,
): { currency: string; amount: number | null } | null {
  if (!hotelRateInfo) return null;
  const ranges = asRecord(hotelRateInfo.RateRanges);
  for (const row of asArray(ranges?.RateRange ?? hotelRateInfo.RateRange)) {
    const range = asRecord(row);
    if (!range) continue;
    const currency = asString(range.CurrencyCode);
    const converted = asString(range.ConvertedCurrencyCode);
    if (!currency) continue;
    if (converted && converted.toUpperCase() === currency.toUpperCase()) {
      continue;
    }
    const amount =
      asNumber(range.MinRate) ??
      asNumber(range.MaxRate) ??
      null;
    return { currency, amount };
  }
  return null;
}

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
    const hotelRateInfo = asRecord(hotel.HotelRateInfo);
    const supplierFromRange = rateRangeSupplierCurrency(hotelRateInfo);
    const rates = extractPricedRateRows(hotel).map((row) => {
      if (!supplierFromRange) return row;
      if (asString(asRecord(row)?.SupplierCurrencyCode)) return row;
      return {
        ...row,
        SupplierCurrencyCode: supplierFromRange.currency,
        SupplierAmountAfterTax:
          asNumber(asRecord(row)?.SupplierAmountAfterTax) ??
          supplierFromRange.amount,
      };
    });

    quotes.push(
      ...mapRateInfosToQuotes({
        source: input.source,
        propertyId: input.propertyId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        currency: input.currency,
        hotelCode,
        hotelName,
        rates,
        shopStep: "avail",
        hotelFacts: extractHotelAdvisorFacts(hotelInfo),
      }),
    );
  }

  return quotes;
}
