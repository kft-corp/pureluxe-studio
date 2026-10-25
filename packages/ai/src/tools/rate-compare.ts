/**
 * Hotel rate table built by the server from rates_search (Stage 3c).
 * Shown under the agent reply; never parsed from model text.
 */

export type RateCompareRoom = {
  /** Stored rate_search_results.id — used when adding to the quote. */
  rate_ref: string;
  room_name: string;
  /** All-in team cost for the party as searched (stay total). */
  team_cost: number;
  /** Client stay total at the suggested markup. */
  client_total: number;
  /** Client cost per night (client_total / nights). */
  client_per_night: number;
  /** Team cost per night (team_cost / nights). */
  team_per_night: number;
  currency: string;
  /** "per_room" or "total" for how many rooms were searched. */
  pricing_scope: "per_room" | "total";
  rooms: number;
  /** Short board / meal-plan label, e.g. "Half board" / "AI". */
  board: string | null;
  /** Advisor-facing source, e.g. "Contracted" / "Sabre". */
  source: string;
  /** One-line cancel summary when known. */
  cancel: string | null;
  /** Absolute cancel-by date (YYYY-MM-DD) from check-in minus cancel days. */
  cancel_by: string | null;
  /** Days before check-in used for cancel_by, when parsed. */
  cancel_days: number | null;
  /** Inclusions / amenities for this rate (short list). */
  inclusions: string[];
  /** Markup % used for client columns. */
  markup_percent: number;
  /** Best room for this search (at most one across the card). */
  recommended: boolean;
  /** Suggested markup buttons, e.g. 25 / 30. */
  markup_buttons: number[];
};

export type RateCompareHotelStatus =
  | "ok"
  | "no_rates"
  | "not_in_pureluxe"
  | "several_matches"
  | "offline"
  | "timeout";

/** Notes shown once under each hotel's room table. */
export type RateCompareHotelNotes = {
  /** Cancel policy with cancel-by date when known. */
  cancellation: string | null;
  /** Commission rate line for the advisor (min % used for client columns). */
  markup: string | null;
  /** Combined inclusions across rooms (deduped, short). */
  inclusions: string[];
};

export type RateCompareHotel = {
  hotel: string;
  status: RateCompareHotelStatus;
  /** Lowest all-in team cost among rooms when status is ok. */
  from_cost: number | null;
  currency: string | null;
  /** Primary source for the hotel header (best/common among rooms). */
  source: string | null;
  /** Best hotel for this search (at most one). */
  recommended: boolean;
  rooms: RateCompareRoom[];
  notes: RateCompareHotelNotes;
  /**
   * Short line: which room(s) to put in front of the client at this hotel.
   * e.g. "Ocean Pool Villa (primary) · Beach Villa (value)"
   */
  suggest_to_client: string | null;
  /** One line when status is not ok (alternatives or paste a quote). */
  note: string | null;
  alternatives: string[];
};

export type RateCompareCard = {
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  /** Stay length when dates parse. */
  nights: number | null;
  /** When this search was run (ISO). */
  searched_at?: string | null;
  /** Shared terms kept for older clients; prefer hotel notes. */
  shared_terms: string[];
  /** A client preference that matters for the choice, when known. */
  preference: string | null;
  /**
   * Overall short pick across hotels for the advisor.
   * e.g. "Six Senses Kanuhura · Ocean Pool Villa"
   */
  suggest_to_client: string | null;
  hotels: RateCompareHotel[];
};
