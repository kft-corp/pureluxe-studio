import { describe, expect, it } from "vitest";

import {
  isOptionsAdd,
  isSupplierPaste,
  matchRateChoice,
  parseSellMessage,
  wantsRateSearch,
} from "@/lib/trip-builder/intents";

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

describe("isSupplierPaste", () => {
  it.each([
    ["Atlantis total USD 3000", true],
    ["Rate: 450 per night", true],
    ["what is the price for 2 rooms?", false],
    ["is USD 3000 too high?", false],
    ["search rates", false],
  ])("%j", (input, expected) => {
    expect(isSupplierPaste(input)).toBe(expected);
  });
});

describe("parseSellMessage", () => {
  it.each([
    ["sell 4500 USD", { sell_total: 4500, sell_currency: "USD" }],
    ["sell price: EUR 3200", { sell_total: 3200, sell_currency: "EUR" }],
    ["sell 4500", { sell_total: 4500, sell_currency: "USD" }],
    ["client price 4500 USD", null],
  ])("%j", (input, expected) => {
    expect(parseSellMessage(input)).toEqual(expected);
  });
});
