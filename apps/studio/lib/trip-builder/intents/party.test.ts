import { describe, expect, it } from "vitest";

import { classifyPartyIntent, parseLeadChange, parseTravellerCommand } from "./party";

describe("classifyPartyIntent", () => {
  it.each([
    ["just them", { intent: "confirm_party" }],
    ["That's everyone.", { intent: "confirm_party" }],
    ["make Ravi a child", { intent: "set_role", name: "Ravi", role: "child" }],
    ["remove Ravi", { intent: "remove_traveller", name: "Ravi" }],
    ["Can you add Ravi please?", { intent: "add_traveller", name: "Ravi", child: false }],
    ["add Ravi as a child", { intent: "add_traveller", name: "Ravi", child: true }],
    ["change the lead to Ravi", { intent: "change_lead", name: "Ravi" }],
    ["what is the visa", null],
  ])("%j", (input, expected) => {
    expect(classifyPartyIntent(input)).toEqual(expected);
  });

  it("does not read a stay line as a traveller", () => {
    expect(classifyPartyIntent("add another stay in Dubai")).toBeNull();
    expect(classifyPartyIntent("remove Dubai stay")).toBeNull();
  });
});

describe("parseLeadChange", () => {
  it("returns the new lead", () => {
    expect(parseLeadChange("switch the lead to Ravi Mehta")).toEqual({ name: "Ravi Mehta" });
  });

  it("is null for other party lines", () => {
    expect(parseLeadChange("add Ravi")).toBeNull();
  });
});

describe("parseTravellerCommand", () => {
  it.each([
    ["just them", { kind: "confirm" }],
    ["remove Ravi", { kind: "remove", name: "Ravi" }],
    ["add Ravi as a child", { kind: "add", name: "Ravi", child: true }],
    ["make Ravi an adult", { kind: "role", name: "Ravi", role: "adult" }],
    ["change the lead to Ravi", null],
  ])("%j", (input, expected) => {
    expect(parseTravellerCommand(input)).toEqual(expected);
  });
});
