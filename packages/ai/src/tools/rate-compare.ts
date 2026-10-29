/**
 * Hotel rate table built by the server from rates_search (Stage 3c).
 * Shown under the agent reply; never parsed from model text.
 */

export type RateCompareRoom = {
  /** Stored rate_search_results.id — used when adding to the quote. */
  rate_ref: string;
  room_name: string;
  /**
   * All-in team cost for the stay (package + extra nights when used).
   * Quote sell / markup applies to this figure.
   */
  team_cost: number;
  /** Client stay total after advisor markup; null until a markup is chosen. */
  client_total: number | null;
  /** Client cost per night; null until a markup is chosen. */
  client_per_night: number | null;
  /** Team cost per night (team_cost / nights). Nightly rates only in the UI. */
  team_per_night: number;
  currency: string;
  /** "per_room" or "total" for how many rooms were searched. */
  pricing_scope: "per_room" | "total";
  rooms: number;
  /** Short board / meal-plan label, e.g. "Half board" / "AI". */
  board: string | null;
  /** Advisor-facing source, e.g. "Contracted" / "Sabre". */
  source: string;
  /**
   * nightly = villa/night contract; package = fixed 3N/4N (or similar) product.
   * Null when the source did not say.
   */
  rate_basis: "nightly" | "package" | null;
  /** Package length from the contract (e.g. 3). Null when not a package. */
  package_nights: number | null;
  /**
   * Team package-sheet amount (before extra nights). Shown in the Package total
   * column; null when not a package. Stay sell still uses team_cost.
   */
  package_team: number | null;
  /** Extra nights beyond package_nights for this stay (0 when exact package). */
  extra_nights_count: number | null;
  /** Team extra-night amount when the stay is longer than the package. */
  extra_night_team: number | null;
  /** Client extra-night after advisor markup; null until a markup is chosen. */
  extra_night_client: number | null;
  /** Short advisor label, e.g. "3N package" or "3N + 1 extra". */
  package_label: string | null;
  /** One-line cancel summary when known. */
  cancel: string | null;
  /** Absolute cancel-by date (YYYY-MM-DD) from check-in minus cancel days. */
  cancel_by: string | null;
  /** Days before check-in used for cancel_by, when parsed. */
  cancel_days: number | null;
  /** Inclusions / amenities for this rate (short list). */
  inclusions: string[];
  /** Markup % used for client columns; null until the advisor picks one. */
  markup_percent: number | null;
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
  /** Applied markup line when the advisor has chosen one; otherwise null. */
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
