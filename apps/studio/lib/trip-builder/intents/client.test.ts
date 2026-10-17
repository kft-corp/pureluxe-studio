import { describe, expect, it } from "vitest";

import { clientNameFromMessage, wantsAssignClient } from "./client";

describe("clientNameFromMessage", () => {
  it.each([
    ["create a trip for Sarah Chen", "Sarah Chen"],
    ["start a trip for Sarah Chen please", "Sarah Chen"],
    ["add Sarah Chen", "Sarah Chen"],
    ["what is next", null],
  ])("%j", (input, expected) => {
    expect(clientNameFromMessage(input)).toBe(expected);
  });
});

describe("wantsAssignClient", () => {
  it("needs a verb and a name", () => {
    expect(wantsAssignClient("add Sarah")).toBe(true);
    expect(wantsAssignClient("assign Ravi Mehta")).toBe(true);
    expect(wantsAssignClient("what is next")).toBe(false);
  });
});
