import { describe, expect, it } from "vitest";

import {
  cancellationLinesFromPolicies,
  cancellationLinesFromPoliciesV2,
  isPoliciesV2,
  readContractPolicies,
  upgradePoliciesToV2,
} from "../../../src/offline";

describe("contract policies v2 (Stage 4 / R3)", () => {
  it("detects schema_version >= 2", () => {
    expect(isPoliciesV2({ schema_version: 2 })).toBe(true);
    expect(isPoliciesV2({ stay_rules: ["Check-in 14:00"] })).toBe(false);
  });

  it("reads v2 cancellation rules and skips team-only lines", () => {
    const lines = cancellationLinesFromPoliciesV2({
      schema_version: 2,
      cancellation: [
        { text: "Free cancel until 30 days before arrival", audience: "client" },
        { text: "Internal: waive for VIP", audience: "team" },
        { audience: "client", cancel_days: 14, charge_pct: 50, season: "peak" },
      ],
    });
    expect(lines).toEqual([
      "Free cancel until 30 days before arrival.",
      "Peak: cancel within 14 days and the charge is 50%.",
    ]);
  });

  it("maps legacy payment_rules cancel entries through the shared reader", () => {
    const lines = cancellationLinesFromPolicies({
      payment_rules: [
        { season: "peak", cancel_days: 30, charge_pct: 100 },
        "Deposit 50% on confirmation",
      ],
    });
    expect(lines).toEqual(["Peak: cancel within 30 days and the charge is 100%."]);
  });

  it("upgrades legacy policies without inventing rules", () => {
    const upgraded = upgradePoliciesToV2({
      check_in_time: "14:00",
      stay_rules: ["Minimum stay 3 nights"],
      payment_rules: [{ season: "peak", cancel_days: 21, charge_pct: 50 }],
      transfer_policies: ["Seaplane included"],
    });
    expect(upgraded.schema_version).toBe(2);
    expect(upgraded.stay?.[0]?.check_in_time).toBe("14:00");
    expect(upgraded.cancellation?.[0]?.cancel_days).toBe(21);
    expect(readContractPolicies(upgraded).transfer?.[0]?.text).toContain("Seaplane");
  });
});
