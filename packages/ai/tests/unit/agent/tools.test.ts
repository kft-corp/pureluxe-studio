import { AppError } from "@pureluxe/shared";
import { describe, expect, it, vi } from "vitest";

import { REDACTED } from "../../../src/agent/redact";
import { TRIP_AGENT_TOOLS, bindAgentTools, findAgentTool } from "../../../src/agent/tools";
import { createTurnMeter } from "../../../src/tools";
import { CLIENT_ID, makeHandlers } from "../../fixtures/agent";

function bind(handlers = makeHandlers()) {
  const meter = createTurnMeter();
  const tools = bindAgentTools(TRIP_AGENT_TOOLS, { handlers, meter });
  const byName = (name: string) => tools.find((tool) => tool.name === name)!;
  return { handlers, meter, byName };
}

describe("trip agent tools", () => {
  it("are all read-only in Stage 1 and grouped by area", () => {
    for (const spec of TRIP_AGENT_TOOLS) {
      expect(spec.risk).toBe("read");
      expect(spec.name).toMatch(/^(?:trip|client|history|hotel|place|rates)_[a-z_]+$/);
    }
    expect(findAgentTool("quote_send")).toBeNull();
  });

  it("maps model input to the Studio handler and times the call", async () => {
    const { handlers, meter, byName } = bind();
    handlers.searchTrips.mockResolvedValue({ trips: [], total: 0 });

    const content = await byName("history_search_trips").invoke({ client_id: CLIENT_ID, mine: false });

    expect(handlers.searchTrips).toHaveBeenCalledWith({
      clientId: CLIENT_ID,
      query: undefined,
      stage: undefined,
      mine: false,
      limit: undefined,
    });
    expect(JSON.parse(content as string)).toEqual({ trips: [], total: 0 });
    expect(meter.read().toolCalls).toEqual([
      expect.objectContaining({ name: "history_search_trips", ok: true, error_code: null }),
    ]);
  });

  it("returns an access error to the model so it can explain", async () => {
    const { handlers, meter, byName } = bind();
    handlers.searchBookings.mockRejectedValue(
      new AppError({ userMessage: "No access to Bookings.", code: "auth.forbidden", status: 403 }),
    );

    const content = await byName("history_search_bookings").invoke({});

    expect(JSON.parse(content as string)).toEqual({ error: "No access to Bookings." });
    expect(meter.read().toolCalls[0]).toMatchObject({ ok: false, error_code: "auth.forbidden" });
  });

  it("hides internal failures behind a retry message", async () => {
    const { handlers, byName } = bind();
    handlers.getRateSnapshot.mockRejectedValue(new Error("connection reset"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const content = await byName("rates_get_snapshot").invoke({});

    expect(JSON.parse(content as string).error).toMatch(/couldn't be loaded/);
    expect(content).not.toMatch(/connection reset/);
    log.mockRestore();
  });

  it("removes sensitive fields before the result enters memory", async () => {
    const { handlers, byName } = bind();
    handlers.getHotel.mockResolvedValue({
      hotels: [{ name: "Resort", city: null, country: null, contracted: true, facts: "SWIFT: HSBCINBB" }],
    });

    const content = await byName("hotel_get").invoke({ name: "Resort" });

    expect(JSON.parse(content as string).hotels[0].facts).toBe(`SWIFT: ${REDACTED}`);
  });

  it("rejects bad input before the handler runs", async () => {
    const { handlers, byName } = bind();
    await expect(byName("client_get").invoke({ client_id: "not-a-uuid" })).rejects.toThrow();
    expect(handlers.getClient).not.toHaveBeenCalled();
  });

  it("refuses a check-out without an earlier check-in", async () => {
    const { handlers, byName } = bind();
    const content = await byName("hotel_get").invoke({ name: "Resort", check_out: "2026-12-15" });
    expect(JSON.parse(content as string)).toEqual({ error: "check_out needs a check_in before it." });
    expect(handlers.getHotel).not.toHaveBeenCalled();
  });
});
