/**
 * Multi-city date split card built by the server from trip_propose_split (Stage 4).
 * Shown under the agent reply; never parsed from model text.
 */

export type LegSplitStay = {
  city: string;
  check_in: string;
  check_out: string;
  hotel?: string | null;
  rooms?: number | null;
};

export type LegSplitCard = {
  /** Short question, e.g. "Malé 10–12, Baa Atoll 12–15?" */
  summary: string;
  stays: LegSplitStay[];
};
