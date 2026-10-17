import { describe, expect, it } from "vitest";

import { priceCheck } from "@/components/trip-builder/price-check";
import { makeRateOption } from "@/tests/factories/rates";
import { makeRate, makeTripDetail } from "@/tests/factories/trips";

const CHOSEN = makeRate({
  id: "r1",
  leg_id: "leg-dubai",
  title: "Atlantis",
  subtitle: "Ocean Suite",
  cost_internal: 3000,
  sell_amount: 4000,
  currency: "USD",
  selected: true,
});

const TRIP = makeTripDetail({ rates: { selected: null, candidates: [CHOSEN] } });

describe("priceCheck", () => {
  it("asks for the client's room first", () => {
    const trip = makeTripDetail();
    expect(priceCheck(trip, "leg-dubai", [])).toEqual({
      note: "No room is chosen for this stay yet. Tap **Client chose this** on the room the client picked, then check again.",
      update: null,
    });
  });

  it("says when the room is not in today's results", () => {
    const check = priceCheck(TRIP, "leg-dubai", [makeRateOption({ room_name: "Garden Villa" })]);
    expect(check.note).toContain("**Price check · Ocean Suite**");
    expect(check.note).toContain("Team cost on file **USD 3,000**. Client price **USD 4,000**.");
    expect(check.note).toContain("This room is not in today's results");
    expect(check.update).toBeNull();
  });

  it("offers nothing when today's team cost is the same", () => {
    const check = priceCheck(TRIP, "leg-dubai", [makeRateOption()]);
    expect(check.note).toContain("Today: **Available**, team cost **USD 3,000**.");
    expect(check.note).toContain("The team cost has not changed.");
    expect(check.update).toBeNull();
  });

  it("offers today's cost when it changed", () => {
    const check = priceCheck(TRIP, "leg-dubai", [
      makeRateOption({ room_name: "Ocean suite", cost_internal: 3200, availability_status: "on_request" }),
    ]);
    expect(check.note).toContain("Today: **On request**, team cost **USD 3,200**.");
    expect(check.update).toEqual({ lineItemId: "r1", room: "Ocean Suite", amount: 3200, currency: "USD" });
  });

  it("does not offer a price in another currency", () => {
    const check = priceCheck(TRIP, "leg-dubai", [makeRateOption({ cost_internal: 2800, currency: "EUR" })]);
    expect(check.note).toContain("different currency");
    expect(check.update).toBeNull();
  });
});
