import { describe, expect, it } from "vitest";

import { plainReplyText } from "@/components/trip-builder/trip-builder-helpers";

describe("plainReplyText", () => {
  it("drops markdown symbols but keeps the words", () => {
    const reply = [
      "Two trips are coming up.",
      "",
      "### Six Senses Kanuhura",
      "**Getting there:** seaplane from the airport.",
      "- Half board",
      "- Minimum stay 3 nights",
      "",
      "> **Heads-up:** peak season starts soon.",
    ].join("\n");

    expect(plainReplyText(reply)).toBe(
      [
        "Two trips are coming up.",
        "",
        "Six Senses Kanuhura",
        "Getting there: seaplane from the airport.",
        "• Half board",
        "• Minimum stay 3 nights",
        "",
        "Heads-up: peak season starts soon.",
      ].join("\n"),
    );
  });

  it("turns status pills, links and table rows into plain text", () => {
    const reply = [
      "**Ravi Mehta** · Maldives · `Confirmed`",
      "See the [trip page](/trips/1).",
      "",
      "| Hotel | Board |",
      "| --- | --- |",
      "| Kanuhura | Half board |",
    ].join("\n");

    expect(plainReplyText(reply)).toBe(
      ["Ravi Mehta · Maldives · Confirmed", "See the trip page.", "", "Hotel · Board", "", "Kanuhura · Half board"].join(
        "\n",
      ),
    );
  });
});
