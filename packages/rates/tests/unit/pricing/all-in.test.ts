import { describe, expect, it } from "vitest";

import { priceContractedRoom } from "../../../src/pricing";
import {
  beachPoolHigh,
  beachVillaHigh,
  greenTax,
  highSeasonRates,
  indiaBeachHigh,
  indiaContract,
  wholesaleAddons,
  wholesaleContract,
  wholesaleOffers,
} from "../../fixtures/kanuhura-contract";

const HIGH_STAY = {
  check_in: "2027-01-10",
  check_out: "2027-01-15",
} as const;

describe("priceContractedRoom (Stage 3b)", () => {
  it("prices 2 adults + 2 children in 2 rooms higher than 2 adults in 1 room (golden #18)", () => {
    const oneRoom = priceContractedRoom({
      rates: highSeasonRates,
      rate: beachPoolHigh,
      contract: { ...wholesaleContract, service_charge_pct: null, tax_pct: null },
      addons: [greenTax],
      offers: [],
      ...HIGH_STAY,
      adults: 2,
      children: 0,
      rooms: 1,
    });

    const twoRooms = priceContractedRoom({
      rates: highSeasonRates,
      rate: beachPoolHigh,
      contract: { ...wholesaleContract, service_charge_pct: null, tax_pct: null },
      addons: [greenTax],
      offers: [],
      ...HIGH_STAY,
      adults: 2,
      children: 2,
      rooms: 2,
      child_ages: [8, 6],
    });

    expect(oneRoom.status).toBe("ok");
    expect(twoRooms.status).toBe("ok");
    if (oneRoom.status !== "ok" || twoRooms.status !== "ok") return;

    expect(oneRoom.price.scope).toBe("per_room");
    expect(twoRooms.price.scope).toBe("total");
    expect(twoRooms.price.rooms).toBe(2);
    expect(twoRooms.price.cost_internal).toBeGreaterThan(oneRoom.price.cost_internal);
    // Two villas: 2 × 1690 × 5 nights, plus green tax for more people
    expect(twoRooms.price.room_cost).toBe(1690 * 5 * 2);
    expect(oneRoom.price.room_cost).toBe(1690 * 5);
  });

  it("hides a 2-adult villa when three adults share one room (golden #13 occupancy)", () => {
    const result = priceContractedRoom({
      rates: highSeasonRates,
      rate: beachVillaHigh,
      contract: wholesaleContract,
      addons: wholesaleAddons,
      offers: wholesaleOffers,
      ...HIGH_STAY,
      adults: 3,
      children: 0,
      rooms: 1,
    });

    expect(result).toEqual({ status: "hidden", reason: "occupancy" });
  });

  it("hides an India-only contract from a US client (golden #13 market / R11)", () => {
    const result = priceContractedRoom({
      rates: [indiaBeachHigh],
      rate: indiaBeachHigh,
      contract: indiaContract,
      addons: [],
      offers: [],
      ...HIGH_STAY,
      adults: 2,
      children: 0,
      rooms: 1,
      client_market_codes: ["US"],
    });

    expect(result).toEqual({ status: "hidden", reason: "market" });
  });

  it("builds an all-in price with green tax, offer, service charge and tax (golden #13)", () => {
    const result = priceContractedRoom({
      rates: highSeasonRates,
      rate: beachPoolHigh,
      contract: wholesaleContract,
      addons: [greenTax],
      offers: wholesaleOffers,
      ...HIGH_STAY,
      adults: 2,
      children: 0,
      rooms: 1,
      book_as_of: "2026-10-01",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const nights = 5;
    const room = 1690 * nights;
    const green = 12 * 2 * nights; // 2 adults age 30 assumed
    // Offer % applies to room (+ occupancy extras), then mandatory extras, then SC/tax
    const afterOffer = room * 0.75;
    const net = afterOffer + green;
    const sc = Math.round(net * 0.1 * 100) / 100;
    const tax = Math.round((net + sc) * 0.17 * 100) / 100;
    const allIn = Math.round((net + sc + tax) * 100) / 100;

    expect(result.price.room_cost).toBe(room);
    expect(result.price.mandatory_extras).toBe(green);
    expect(result.price.offers_discount).toBe(room - afterOffer);
    expect(result.price.applied_offers.map((o) => o.name)).toContain(
      "High 25% off villa",
    );
    expect(result.price.service_charge).toBe(sc);
    expect(result.price.tax).toBe(tax);
    expect(result.price.cost_internal).toBe(allIn);
    // All-in = discounted room + mandatory + SC + tax (offer can pull all-in below raw room_only)
    expect(result.price.cost_internal).toBe(
      Math.round(
        (result.price.room_only -
          result.price.offers_discount +
          result.price.mandatory_extras +
          result.price.service_charge +
          result.price.tax) *
          100,
      ) / 100,
    );
  });

  it("flags needs_child_ages when child bands change the price and ages are missing (Fix 8)", () => {
    const result = priceContractedRoom({
      rates: highSeasonRates,
      rate: beachPoolHigh,
      contract: { ...wholesaleContract, service_charge_pct: null, tax_pct: null },
      addons: wholesaleAddons,
      offers: [],
      ...HIGH_STAY,
      adults: 2,
      children: 2,
      rooms: 2,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.price.child_ages_assumed).toBe(true);
    expect(result.price.needs_child_ages).toBe(true);
  });
});
