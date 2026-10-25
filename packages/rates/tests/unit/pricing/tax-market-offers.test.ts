import { describe, expect, it } from "vitest";

import {
  applyQualifyingOffers,
  applyServiceChargeAndTax,
  contractAllowedForMarket,
} from "../../../src/pricing";
import { highSeasonOffer } from "../../fixtures/kanuhura-contract";

describe("applyServiceChargeAndTax (R10)", () => {
  it("adds Maldives-style service charge then tax on room + SC", () => {
    const result = applyServiceChargeAndTax({
      net: 1000,
      taxes_included: false,
      service_charge_pct: 10,
      tax_pct: 17,
      tax_on_service_charge: true,
    });

    expect(result.service_charge).toBe(100);
    expect(result.tax).toBe(187); // 17% of 1100
    expect(result.all_in).toBe(1287);
  });

  it("skips SC and tax when taxes are already included", () => {
    const result = applyServiceChargeAndTax({
      net: 1000,
      taxes_included: true,
      service_charge_pct: 10,
      tax_pct: 17,
      tax_on_service_charge: true,
    });

    expect(result).toEqual({ service_charge: 0, tax: 0, all_in: 1000 });
  });
});

describe("contractAllowedForMarket (R11)", () => {
  it("hides an India-only contract from a US client", () => {
    expect(contractAllowedForMarket(["IN"], ["US"])).toBe(false);
  });

  it("shows an India-only contract to an IN client", () => {
    expect(contractAllowedForMarket(["IN"], ["IN"])).toBe(true);
  });

  it("shows unrestricted contracts to any client", () => {
    expect(contractAllowedForMarket([], ["US"])).toBe(true);
  });

  it("keeps restricted contracts visible when the client market is unknown", () => {
    expect(contractAllowedForMarket(["IN"], [])).toBe(true);
  });
});

describe("applyQualifyingOffers (R9)", () => {
  it("takes 25% off the villa when the high-season offer qualifies", () => {
    const { room_after_offers, applied } = applyQualifyingOffers({
      offers: [highSeasonOffer],
      room_cost: 8450,
      room_category: "Beach Villa with Pool",
      check_in: "2027-01-10",
      check_out: "2027-01-15",
      contract_id: "contract-wholesale",
      book_as_of: "2026-10-01",
    });

    expect(applied).toHaveLength(1);
    expect(applied[0]?.name).toBe("High 25% off villa");
    expect(room_after_offers).toBe(6337.5);
  });

  it("skips the offer when min nights are not met", () => {
    const { room_after_offers, applied } = applyQualifyingOffers({
      offers: [highSeasonOffer],
      room_cost: 3380,
      room_category: "Beach Villa with Pool",
      check_in: "2027-01-10",
      check_out: "2027-01-12",
      contract_id: "contract-wholesale",
      book_as_of: "2026-10-01",
    });

    expect(applied).toHaveLength(0);
    expect(room_after_offers).toBe(3380);
  });
});
