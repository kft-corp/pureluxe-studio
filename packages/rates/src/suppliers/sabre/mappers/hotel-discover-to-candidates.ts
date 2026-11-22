import { asArray, asRecord, asString } from "../helpers";
import { extractHotelAdvisorFacts } from "./rate-fields";

/** Open-GDS discover hit — code + name + advisor facts (never a properties row). */
export type SabreDiscoverHotel = {
  hotelCode: string;
  hotelName: string;
  sabreRating: string | null;
  city: string | null;
  quality: string | null;
  amenities: string[];
};

/**
 * Map GetHotelAvailRS (geo/airport discover) → shortlist candidates.
 * Caps caller-side; extracts HotelCode + HotelName + compact advisor facts.
 */
export function mapHotelDiscoverToCandidates(
  response: unknown,
  options?: { max?: number; minSabreRating?: number },
): SabreDiscoverHotel[] {
  const root = asRecord(response);
  const rs = asRecord(root?.GetHotelAvailRS) ?? root;
  if (!rs) return [];

  const availInfos = asRecord(rs.HotelAvailInfos);
  const hotels = asArray(availInfos?.HotelAvailInfo ?? rs.HotelAvailInfo);
  const max = Math.min(Math.max(options?.max ?? 5, 1), 5);
  const minRating = options?.minSabreRating ?? 4;

  const out: SabreDiscoverHotel[] = [];
  const seen = new Set<string>();

  for (const hotelRow of hotels) {
    if (out.length >= max) break;
    const hotel = asRecord(hotelRow);
    if (!hotel) continue;

    const hotelInfo = asRecord(hotel.HotelInfo) ?? {};
    const hotelCode = asString(hotelInfo.HotelCode);
    const hotelName = asString(hotelInfo.HotelName);
    if (!hotelCode || !hotelName) continue;

    const codeKey = hotelCode.toUpperCase();
    if (seen.has(codeKey)) continue;

    const facts = extractHotelAdvisorFacts(hotelInfo);
    const ratingRaw = facts.rating ?? asString(hotelInfo.SabreRating);
    const ratingNum = ratingRaw ? Number.parseFloat(ratingRaw) : null;
    if (
      ratingNum != null &&
      Number.isFinite(ratingNum) &&
      ratingNum < minRating
    ) {
      continue;
    }

    seen.add(codeKey);
    out.push({
      hotelCode,
      hotelName,
      sabreRating: ratingRaw,
      city: facts.city,
      quality: facts.quality,
      amenities: facts.amenities,
    });
  }

  return out;
}
