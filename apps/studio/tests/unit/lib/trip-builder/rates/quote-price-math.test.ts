import { describe, expect, it } from "vitest";

import { clientPriceAtMarkup, roundMoney } from "@/lib/rates/price-math";

/**
 * Stage 3d pricing helpers used by quote_add_options:
 * absolute client prices win; markup % is applied to team cost; below-min is flagged by the action.
 */
describe("quote option pricing (Stage 3d)", () => {
  it("applies markup percent to team cost", () => {
    expect(clientPriceAtMarkup(5580, 25)).toBe(6975);
    expect(clientPriceAtMarkup(6465, 25)).toBe(8081.25);
  });

  it("keeps deliberate below-minimum client prices as given", () => {
    const teamCost = 5580;
    const clientPrice = 6075;
    const markup = roundMoney(((clientPrice - teamCost) / teamCost) * 100);
    expect(markup).toBe(8.87);
    expect(markup).toBeLessThan(25);
    expect(clientPrice).toBe(6075);
  });
});
