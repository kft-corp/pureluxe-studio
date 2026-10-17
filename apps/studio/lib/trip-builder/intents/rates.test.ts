import { describe, expect, it } from "vitest";

import { isOptionsAdd, matchRateChoice, wantsRateSearch } from "./rates";

describe("wantsRateSearch", () => {
  it.each([
    ["search rates", true],
    ["check prices for this stay", true],
    ["what is the weather", false],
  ])("%j", (input, expected) => {
    expect(wantsRateSearch(input)).toBe(expected);
  });
});

describe("matchRateChoice", () => {
  const water = { title: "Water Villa" };
  const beach = { title: "Beach Villa" };
  const rooms = [water, beach];

  it.each([
    ["select 2", beach],
    ["#1", water],
    ["the first", water],
    ["select water villa", water],
    ["Water Villa", water],
    ["add beach villa to the options quote", beach],
    ["select villa", "ambiguous"],
    ["villa", null],
    ["select 5", null],
    ["yes", null],
  ])("%j", (input, expected) => {
    expect(matchRateChoice(input, rooms)).toBe(expected);
  });

  it("is null with no rooms listed", () => {
    expect(matchRateChoice("select 1", [])).toBeNull();
  });
});

describe("isOptionsAdd", () => {
  it.each([
    ["add 2 to the options quote", true],
    ["include the water villa", true],
    ["select 2", false],
    ["client chose 2", false],
  ])("%j", (input, expected) => {
    expect(isOptionsAdd(input)).toBe(expected);
  });
});
