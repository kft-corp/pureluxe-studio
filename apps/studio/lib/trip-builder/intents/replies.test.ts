import { describe, expect, it } from "vitest";

import { isConfirmReply, isDeclineReply } from "./replies";

describe("isConfirmReply", () => {
  it.each(["yes", "Yes!", "okay", " go ahead "])("%j is a yes", (input) => {
    expect(isConfirmReply(input)).toBe(true);
  });

  it.each(["okay, what is the visa?", "yes please add Ravi", "no"])("%j is not a yes", (input) => {
    expect(isConfirmReply(input)).toBe(false);
  });
});

describe("isDeclineReply", () => {
  it.each(["no", "Nope.", "cancel", "don't"])("%j is a no", (input) => {
    expect(isDeclineReply(input)).toBe(true);
  });

  it.each(["no thanks, search rates", "yes"])("%j is not a no", (input) => {
    expect(isDeclineReply(input)).toBe(false);
  });
});
