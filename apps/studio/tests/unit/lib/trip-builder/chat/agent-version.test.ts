import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tripAgentVersionFor } from "@/lib/trip-builder/chat/agent-version";

const PILOT = "0f7e1d2c-3b4a-4596-8877-665544332211";

describe("tripAgentVersionFor", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://agent@localhost:6543/postgres");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives v2 only to pilot advisors", () => {
    vi.stubEnv("TRIP_AGENT_V2_MEMBER_IDS", ` ${PILOT.toUpperCase()}, other-id `);
    expect(tripAgentVersionFor(PILOT)).toBe("v2");
    expect(tripAgentVersionFor("someone-else")).toBe("v1");
  });

  it("keeps everyone on v1 when the list is empty", () => {
    vi.stubEnv("TRIP_AGENT_V2_MEMBER_IDS", "");
    expect(tripAgentVersionFor(PILOT)).toBe("v1");
  });

  it("gives everyone v2 with *", () => {
    vi.stubEnv("TRIP_AGENT_V2_MEMBER_IDS", "*");
    expect(tripAgentVersionFor("anyone")).toBe("v2");
  });

  it("falls back to v1 without DATABASE_URL so chat keeps working", () => {
    vi.stubEnv("TRIP_AGENT_V2_MEMBER_IDS", PILOT);
    vi.stubEnv("DATABASE_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(tripAgentVersionFor(PILOT)).toBe("v1");
    warn.mockRestore();
  });
});
