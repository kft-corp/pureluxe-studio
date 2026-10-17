import { describe, expect, it } from "vitest";

import {
  isPriceSkip,
  looksLikeOptionsPdfEdit,
  parseMoneyReply,
  parseOptionClientPrice,
  parseOptionsWording,
  splitTrailingPrice,
  wantsOptionsPreview,
} from "./options-quote";

describe("parseMoneyReply", () => {
  it.each([
    ["2400", { amount: 2400, currency: null }],
    ["2,400 usd", { amount: 2400, currency: "USD" }],
    ["USD 2400", { amount: 2400, currency: "USD" }],
    ["set the client price to 3125.50 EUR", { amount: 3125.5, currency: "EUR" }],
    ["about two thousand", null],
  ])("%j", (input, expected) => {
    expect(parseMoneyReply(input)).toEqual(expected);
  });
});

describe("isPriceSkip", () => {
  it("accepts a no-price reply", () => {
    expect(isPriceSkip("to be confirmed")).toBe(true);
    expect(isPriceSkip("price later.")).toBe(true);
    expect(isPriceSkip("2400")).toBe(false);
  });
});

describe("splitTrailingPrice", () => {
  it("separates the room words from the amount", () => {
    expect(splitTrailingPrice("add the beach villa at 2400 USD")).toEqual({
      text: "add the beach villa",
      price: { amount: 2400, currency: "USD" },
    });
  });

  it("leaves a line with no price alone", () => {
    expect(splitTrailingPrice("add the beach villa")).toEqual({
      text: "add the beach villa",
      price: null,
    });
  });
});

describe("parseOptionClientPrice", () => {
  it("reads the amount, currency, and room", () => {
    expect(parseOptionClientPrice("client price 2400 OMR for the water villa")).toEqual({
      amount: 2400,
      currency: "OMR",
      room: "water villa",
    });
  });

  it("reads an amount with no room", () => {
    expect(parseOptionClientPrice("client price 2400")).toEqual({
      amount: 2400,
      currency: null,
      room: null,
    });
  });

  it("is null for other lines", () => {
    expect(parseOptionClientPrice("sell 2400 USD")).toBeNull();
  });
});

describe("options PDF wording", () => {
  it("parseOptionsWording", () => {
    expect(parseOptionsWording("options title: Maldives escape")).toEqual({
      field: "title",
      value: "Maldives escape",
    });
    expect(parseOptionsWording("set the options note to Prices hold for 48 hours")).toEqual({
      field: "notes",
      value: "Prices hold for 48 hours",
    });
    expect(parseOptionsWording("title: Maldives escape")).toBeNull();
  });

  it("wantsOptionsPreview", () => {
    expect(wantsOptionsPreview("show the options quote")).toBe(true);
    expect(wantsOptionsPreview("regenerate options pdf")).toBe(true);
    expect(wantsOptionsPreview("options")).toBe(false);
  });

  it("looksLikeOptionsPdfEdit", () => {
    expect(looksLikeOptionsPdfEdit("replace breakfast with half board")).toBe(true);
    expect(looksLikeOptionsPdfEdit("update the title line")).toBe(true);
    expect(looksLikeOptionsPdfEdit("update me")).toBe(false);
  });
});
