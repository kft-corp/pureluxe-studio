import type { NormalizedRateOption } from "@pureluxe/rates";

export function makeRateOption(partial: Partial<NormalizedRateOption> = {}): NormalizedRateOption {
  return {
    property_id: "prop-atlantis",
    property_name: "Atlantis",
    room_name: "Ocean Suite",
    board: "Bed and breakfast",
    check_in: "2026-10-10",
    check_out: "2026-10-14",
    currency: "USD",
    cost_internal: 3000,
    rate_source_code: "offline_contracted",
    inclusions: [],
    cancellation_summary: null,
    payment_summary: null,
    availability_status: "available",
    recommended: false,
    raw: {},
    ...partial,
  };
}
