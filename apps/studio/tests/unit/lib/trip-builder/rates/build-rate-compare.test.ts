import { describe, expect, it } from "vitest";

import type { NormalizedRateOption } from "@pureluxe/rates";

import { buildRateCompare } from "@/lib/trip-builder/rates/build-rate-compare";
import type { HotelRateSearchOutcome } from "@/lib/trip-builder/rates/search-rates-for-hotels";

function option(partial: Partial<NormalizedRateOption> & Pick<NormalizedRateOption, "room_name" | "cost_internal">): NormalizedRateOption {
  return {
    property_id: "p1",
    property_name: "Six Senses Kanuhura",
    board: "Half board",
    check_in: "2026-12-15",
    check_out: "2026-12-20",
    currency: "USD",
    rate_source_code: "offline_contracted",
    inclusions: ["Breakfast", "Green tax"],
    cancellation_summary: "30-day cancellation",
    payment_summary: "Deposit 50%",
    availability_status: "available",
    recommended: false,
    raw: { pricing_scope: "total" },
    ...partial,
  };
}

function hotel(
  partial: Partial<HotelRateSearchOutcome> & Pick<HotelRateSearchOutcome, "hotel" | "status">,
): HotelRateSearchOutcome {
  return {
    property_id: "p1",
    options: [],
    result_ids: [],
    min_markup_percent: 25,
    note: null,
    alternatives: [],
    ...partial,
  };
}

describe("buildRateCompare (Stage 3c)", () => {
  it("builds one hotel row with rooms and shared terms", () => {
    const rooms = [
      option({ room_name: "Beach Villa with Pool", cost_internal: 6975 }),
      option({ room_name: "Water Villa with Pool", cost_internal: 8881.25 }),
    ];
    const compare = buildRateCompare({
      destination: "Maldives",
      checkIn: "2026-12-15",
      checkOut: "2026-12-20",
      adults: 2,
      children: 2,
      rooms: 2,
      preference: "prefers connecting rooms",
      hotels: [
        hotel({
          hotel: "Six Senses Kanuhura",
          status: "ok",
          options: rooms,
          result_ids: [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
          ],
        }),
        hotel({
          hotel: "Unknown Resort",
          status: "no_rates",
          note: "No rates. Paste a supplier quote.",
          alternatives: ["Vakkaru Maldives"],
        }),
      ],
    });

    expect(compare.hotels).toHaveLength(2);
    expect(compare.hotels[0]?.from_cost).toBe(6975);
    expect(compare.hotels[0]?.rooms).toHaveLength(2);
    expect(compare.hotels[0]?.rooms[0]?.pricing_scope).toBe("total");
    expect(compare.hotels[1]?.status).toBe("no_rates");
    expect(compare.shared_terms).toEqual(
      expect.arrayContaining(["30-day cancellation", "Breakfast", "Green tax"]),
    );
    expect(compare.preference).toBe("prefers connecting rooms");
  });

  it("labels per-room pricing from raw.pricing_scope", () => {
    const compare = buildRateCompare({
      destination: "Maldives",
      checkIn: "2026-12-15",
      checkOut: "2026-12-20",
      adults: 2,
      children: 0,
      rooms: 2,
      preference: null,
      hotels: [
        hotel({
          hotel: "Six Senses Kanuhura",
          status: "ok",
          options: [
            option({
              room_name: "Beach Villa",
              cost_internal: 2000,
              raw: { pricing_scope: "per_room" },
            }),
          ],
          result_ids: ["33333333-3333-4333-8333-333333333333"],
        }),
      ],
    });

    expect(compare.hotels[0]?.rooms[0]?.pricing_scope).toBe("per_room");
  });
});
