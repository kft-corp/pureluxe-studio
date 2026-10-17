import { describe, expect, it } from "vitest";

import { parseQuoteEdit } from "@/lib/trip-builder/intents";

describe("parseQuoteEdit", () => {
  it.each([
    ["title: Maldives honeymoon", { field: "title", value: "Maldives honeymoon" }],
    ["set the intro to Welcome back", { field: "intro", value: "Welcome back" }],
    ["notes: Prices hold for 48 hours", { field: "notes", value: "Prices hold for 48 hours" }],
    ["add highlight: Private sandbank dinner", { field: "highlight", value: "Private sandbank dinner" }],
    ["search rates", null],
  ])("%j", (input, expected) => {
    expect(parseQuoteEdit(input)).toEqual(expected);
  });

  it("caps the title length", () => {
    expect(parseQuoteEdit(`title: ${"a".repeat(300)}`)?.value).toHaveLength(200);
  });
});
