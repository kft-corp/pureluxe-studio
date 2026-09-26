import type { RateSourceCode } from "./source-codes";
import type { RateRoutingMeta } from "./routing";

/** Who is requesting rates (Studio advisor vs later Client Assistant). */
export type RateSearchChannel = "studio" | "client";

/**
 * Input to the Rate Layer brain.
 * Trip Builder (and later Client) build this; adapters never invent ids.
 */
export type SearchRatesRequest = {
  /** Trip the options will attach to (optional until line-item write lands). */
  trip_id?: string;
  /** Leg within the trip (optional until line-item write lands). */
  leg_id?: string;
  /** Free-text destination from the leg, e.g. "Malé" or "Maldives". */
  destination_text?: string | null;
  /** Curated hotel id from public.properties when known. */
  property_id?: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children?: number;
  rooms?: number;
  currency?: string;
  channel?: RateSearchChannel;
  /** Team member running the search (Studio). */
  requested_by_id?: string | null;
  /**
   * Advisor-pasted hotel quote (email/PDF text).
   * Used by the offline_manual adapter.
   */
  paste_text?: string | null;
};

/**
 * One commercial option — always fully populated (no undefined).
 * Same shape for Sabre stub, wholesale, paste, or contracted.
 * Ready to map into trip_line_items via toLineItemFields.
 */
export type NormalizedRateOption = {
  property_id: string | null;
  property_name: string | null;
  room_name: string | null;
  board: string | null;
  check_in: string;
  check_out: string;
  currency: string;
  /** PureLuxe cost — team only; never send to guests. */
  cost_internal: number;
  rate_source_code: RateSourceCode;
  inclusions: string[];
  cancellation_summary: string | null;
  payment_summary: string | null;
  availability_status: "available" | "on_request" | "unknown" | "unavailable";
  recommended: boolean;
  /** Opaque supplier payload; always an object (may be empty). */
  raw: Record<string, unknown>;
};

/** Per-adapter run summary — always present on search results. */
export type AdapterRunSummary = {
  source: RateSourceCode;
  status: "ok" | "empty" | "stub" | "needs_paste";
  quote_count: number;
  message: string | null;
};

export type SearchRatesStatus =
  | "ok"
  | "empty"
  | "stub"
  | "consultant_required";

/**
 * Canonical search envelope — every field always set (use null / [] when empty).
 * Callers (API / Trip Builder) can rely on this shape in all cases.
 */
export type SearchRatesResult = {
  status: SearchRatesStatus;
  options: NormalizedRateOption[];
  routing: RateRoutingMeta;
  /** Team-facing note; null when none. */
  message: string | null;
  /** What each adapter returned (stub/empty/ok). */
  adapters: AdapterRunSummary[];
};
