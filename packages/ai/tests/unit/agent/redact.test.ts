import { describe, expect, it } from "vitest";

import { REDACTED, redactSensitive, redactText } from "../../../src/agent/redact";

describe("redactText", () => {
  it.each([
    ["Passport number: K1234567", `Passport number: ${REDACTED}`],
    ["Aarav's passport number is K1234567.", `Aarav's passport number is ${REDACTED}.`],
    ["passport #Z9876543 for Anika", `passport #${REDACTED} for Anika`],
    ["Their SWIFT code is HSBCINBB", `Their SWIFT code is ${REDACTED}`],
    ["account number is 0012 3456 7890", `account number is ${REDACTED}`],
    ["Her medication is insulin twice daily", `Her medication is ${REDACTED}`],
    ["SWIFT: HSBCINBB", `SWIFT: ${REDACTED}`],
    ["bic code DEUTDEFF500", `bic code ${REDACTED}`],
    ["Account no. 0012 3456 7890", `Account no. ${REDACTED}`],
    ["Medication: insulin twice daily", `Medication: ${REDACTED}`],
    ["Emergency contact: Ravi, +91 98200 00000", `Emergency contact: ${REDACTED}`],
    ["Pay to GB82 WEST 1234 5698 7654 32 today", `Pay to ${REDACTED} today`],
  ])("removes %j", (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  it.each([
    "Passport expires 2027-01-01",
    "Her passport is valid until next year",
    "Confirmation MV2026ABCD12",
    "Beach Villa, 2 adults, 10–15 Dec",
    "Check the account page in Studio",
  ])("keeps %j", (input) => {
    expect(redactText(input)).toBe(input);
  });
});

describe("redactSensitive", () => {
  it("replaces sensitive keys and scrubs nested text, without touching the input", () => {
    const input = {
      client: { name: "Aarav Mehta", document_number: "K1234567", passport_expiry: "2027-01-01" },
      health: { medication_notes: "insulin", dietary_restrictions: ["vegetarian"] },
      hotels: [{ name: "Resort", facts: "Pay SWIFT: HSBCINBB", payout: { bank: "X" } }],
      empty: { iban: null },
    };

    expect(redactSensitive(input)).toEqual({
      client: { name: "Aarav Mehta", document_number: REDACTED, passport_expiry: "2027-01-01" },
      health: { medication_notes: REDACTED, dietary_restrictions: ["vegetarian"] },
      hotels: [{ name: "Resort", facts: `Pay SWIFT: ${REDACTED}`, payout: REDACTED }],
      empty: { iban: null },
    });
    expect(input.client.document_number).toBe("K1234567");
  });
});
