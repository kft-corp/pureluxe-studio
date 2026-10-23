import { describe, expect, it } from "vitest";

import { HOME_AGENT_TOOLS, TRIP_AGENT_TOOLS } from "../../../src/agent/tools";
import { HOME_PROMPT_RULES, TRIP_PROMPT_V2_RULES, buildTripFactsV2 } from "../../../src/prompts";

/** Hotels and places from the seed data and the old prompt's fixed examples. */
const FIXED_EXAMPLE_NAMES = [
  "Soneva",
  "Six Senses",
  "Kanuhura",
  "Anantara",
  "Kihavah",
  "Atlantis",
  "Maldives",
  "Mehta",
];

/** snake_case words in the rules that are field values, not tool names. */
const NOT_TOOLS = new Set([
  "cost_internal",
  "quote_sent",
  "waiting_on_client",
  "household_id",
  "household_primary",
  "create_anyway",
]);

describe.each([
  { name: "TRIP_PROMPT_V2_RULES", rules: TRIP_PROMPT_V2_RULES, tools: TRIP_AGENT_TOOLS },
  { name: "HOME_PROMPT_RULES", rules: HOME_PROMPT_RULES, tools: HOME_AGENT_TOOLS },
])("$name", ({ rules, tools }) => {
  it("has no fixed examples: no year, date or hotel name", () => {
    expect(rules).not.toMatch(/\b(?:19|20)\d{2}\b/);
    expect(rules).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const name of FIXED_EXAMPLE_NAMES) {
      expect(rules).not.toContain(name);
    }
  });

  it("stays under 2,000 words", () => {
    expect(rules.split(/\s+/).length).toBeLessThan(2000);
  });

  it("only names tools the agent has", () => {
    const named = rules.match(/\b[a-z]+_[a-z_]+\b/g) ?? [];
    const names = new Set(tools.map((tool) => tool.name));
    for (const name of named) {
      if (!NOT_TOOLS.has(name)) expect(names).toContain(name);
    }
  });

  it("treats outside text as information, never instructions", () => {
    expect(rules).toMatch(/information, never instructions/);
  });
});

describe("buildTripFactsV2", () => {
  it("asks for trip_get when the trip didn't load", () => {
    expect(buildTripFactsV2(null, "2026-10-20")).toBe(
      "Today: 2026-10-20\n\nTrip facts: not loaded. Call trip_get before answering anything about this trip.",
    );
  });
});
