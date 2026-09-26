import type { NormalizedRateOption } from "../types";

/**
 * Persistent fields ready for trip_line_items insert/update.
 * Same shape whether the option came from Sabre, paste, or contracted.
 */
export type LineItemFields = {
  category: "accommodation";
  title: string;
  subtitle: string | null;
  details: string | null;
  property_id: string | null;
  property_name: string | null;
  currency: string;
  cost_internal: number;
  rate_source_code: string;
  inclusions: string[];
  cancellation_policy: string | null;
  payment_policy: string | null;
  /** Stay + board + availability for review UI / extracted_json. */
  extracted: {
    check_in: string;
    check_out: string;
    board: string | null;
    room_name: string | null;
    availability_status: NormalizedRateOption["availability_status"];
    recommended: boolean;
    raw: Record<string, unknown>;
  };
};

/** Build a stable line-item payload from any normalized option. */
export function toLineItemFields(
  option: NormalizedRateOption,
): LineItemFields {
  const title =
    option.property_name?.trim() ||
    option.room_name?.trim() ||
    `Rate (${option.rate_source_code})`;

  const subtitleParts = [option.room_name, option.board].filter(Boolean);

  return {
    category: "accommodation",
    title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : null,
    details: null,
    property_id: option.property_id,
    property_name: option.property_name,
    currency: option.currency,
    cost_internal: option.cost_internal,
    rate_source_code: option.rate_source_code,
    inclusions: [...option.inclusions],
    cancellation_policy: option.cancellation_summary,
    payment_policy: option.payment_summary,
    extracted: {
      check_in: option.check_in,
      check_out: option.check_out,
      board: option.board,
      room_name: option.room_name,
      availability_status: option.availability_status,
      recommended: option.recommended,
      raw: { ...option.raw },
    },
  };
}

export function toLineItemFieldsList(
  options: NormalizedRateOption[],
): LineItemFields[] {
  return options.map(toLineItemFields);
}
