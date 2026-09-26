import { searchRatesForLeg, type SearchRatesResult } from "@pureluxe/rates";
import type { SearchRatesBody } from "@pureluxe/shared";

/** Thin wrapper — Studio API → @pureluxe/rates brain. */
export async function runRateSearch(
  input: SearchRatesBody,
  actor: { memberId: string },
): Promise<SearchRatesResult> {
  return searchRatesForLeg({
    trip_id: input.trip_id ?? undefined,
    leg_id: input.leg_id ?? undefined,
    destination_text: input.destination_text,
    property_id: input.property_id,
    check_in: input.check_in,
    check_out: input.check_out,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    currency: input.currency,
    channel: "studio",
    requested_by_id: actor.memberId,
    paste_text: input.paste_text,
  });
}
