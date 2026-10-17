import { describe, expect, it } from "vitest";

import {
  isClientQuestion,
  isFollowUpFragment,
  isPlaceQuestion,
  isTripQuestion,
  mightNamePlace,
  wantsHotelSearch,
} from "@/lib/trip-builder/intents";

describe("isPlaceQuestion", () => {
  it.each([
    ["what is the visa for the Maldives?", true],
    ["best time to visit Bali", true],
    ["when is her birthday?", false],
    ["search rates", false],
  ])("%j", (input, expected) => {
    expect(isPlaceQuestion(input)).toBe(expected);
  });
});

describe("isClientQuestion", () => {
  it("covers profile topics", () => {
    expect(isClientQuestion("does she have a passport on file")).toBe(true);
    expect(isClientQuestion("what is the weather")).toBe(false);
  });
});

describe("isTripQuestion", () => {
  it.each([
    ["what is the margin?", true],
    ["is another trip open?", true],
    ["search rates", false],
    ["sell 4500 USD", false],
  ])("%j", (input, expected) => {
    expect(isTripQuestion(input)).toBe(expected);
  });
});

describe("mightNamePlace", () => {
  it.each([
    ["Maldives", true],
    ["Soneva Fushi", true],
    ["sell 4500 USD", false],
    ["yes", false],
    ["ok", false],
  ])("%j", (input, expected) => {
    expect(mightNamePlace(input)).toBe(expected);
  });
});

describe("isFollowUpFragment", () => {
  it.each([
    ["and the visa?", true],
    ["the cheaper one please", true],
    ["make him a child", false],
    ["yes", false],
  ])("%j", (input, expected) => {
    expect(isFollowUpFragment(input)).toBe(expected);
  });
});

describe("wantsHotelSearch", () => {
  it.each([
    ["which hotels do we have in Dubai", true],
    ["where to stay in Bali", true],
    ["search rates", false],
  ])("%j", (input, expected) => {
    expect(wantsHotelSearch(input)).toBe(expected);
  });
});
