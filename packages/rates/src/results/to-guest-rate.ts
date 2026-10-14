import type { NormalizedRateOption } from "../types";

/**
 * Guest-safe rate card — no cost, raw supplier payload, or internal codes.
 */
export type GuestRate = {
  property_id: string | null;
  property_name: string | null;
  room_name: string | null;
  board: string | null;
  check_in: string;
  check_out: string;
  currency: string;
  /** Guest-facing sell price when the advisor has set one. */
  price: number | null;
  inclusions: string[];
  cancellation_summary: string | null;
  payment_summary: string | null;
  availability_status: NormalizedRateOption["availability_status"];
  recommended: boolean;
};

/**
 * Strip team secrets before Client Assistant / guest surfaces.
 */
export function toGuestRate(
  option: NormalizedRateOption,
  sellPrice?: number | null,
): GuestRate {
  return {
    property_id: option.property_id,
    property_name: option.property_name,
    room_name: option.room_name,
    board: option.board,
    check_in: option.check_in,
    check_out: option.check_out,
    currency: option.currency,
    price: sellPrice ?? null,
    inclusions: [...option.inclusions],
    cancellation_summary: option.cancellation_summary,
    payment_summary: option.payment_summary,
    availability_status: option.availability_status,
    recommended: option.recommended,
  };
}

export function toGuestRates(
  options: NormalizedRateOption[],
  sellByIndex?: Array<number | null | undefined>,
): GuestRate[] {
  return options.map((option, index) =>
    toGuestRate(option, sellByIndex?.[index] ?? null),
  );
}
