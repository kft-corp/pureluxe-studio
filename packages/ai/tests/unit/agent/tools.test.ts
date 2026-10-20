import { AppError } from "@pureluxe/shared";
import { describe, expect, it, vi } from "vitest";

import { REDACTED } from "../../../src/agent/redact";
import { TRIP_AGENT_TOOLS, bindAgentTools, findAgentTool } from "../../../src/agent/tools";
import { createTurnMeter } from "../../../src/tools";
import { CLIENT_ID, makeHandlers, makeTripFacts } from "../../fixtures/agent";

function bind(handlers = makeHandlers()) {
  const meter = createTurnMeter();
  const tools = bindAgentTools(TRIP_AGENT_TOOLS, { handlers, meter });
  const byName = (name: string) => tools.find((tool) => tool.name === name)!;
  return { handlers, meter, byName };
}

describe("trip agent tools", () => {
  it("are grouped by area, and only trip_ tools change anything", () => {
    for (const spec of TRIP_AGENT_TOOLS) {
      expect(spec.name).toMatch(/^(?:trip|client|history|hotel|place|rates)_[a-z_]+$/);
      if (spec.risk !== "read") expect(spec.name).toMatch(/^trip_/);
    }
    expect(TRIP_AGENT_TOOLS.filter((spec) => spec.risk === "approval").map((spec) => spec.name)).toEqual([
      "trip_shift_dates",
    ]);
    expect(findAgentTool("quote_send")).toBeNull();
  });

  it("passes the tool call id to a change, so a retry can't apply it twice", async () => {
    const { handlers, byName } = bind();

    await byName("trip_set_dates").invoke({
      id: "call_dates",
      name: "trip_set_dates",
      args: { start: "12-10", end: "12-15" },
      type: "tool_call",
    });

    expect(handlers.setDates).toHaveBeenCalledWith({ start: "12-10", end: "12-15" }, { id: "call_dates" });
  });

  it("runs changes one at a time, in call order", async () => {
    const { handlers, byName } = bind();
    const order: string[] = [];
    const slow = (name: string, ms: number) => async () => {
      order.push(`${name} start`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(`${name} end`);
      return { ok: true as const, summary: name, undo: true };
    };
    handlers.setDates.mockImplementation(slow("dates", 20));
    handlers.setStays.mockImplementation(slow("stays", 0));

    await Promise.all([
      byName("trip_set_dates").invoke({ start: "12-10", end: "12-15" }),
      byName("trip_set_stays").invoke({ stays: [{ city: "Maldives" }] }),
    ]);

    expect(order).toEqual(["dates start", "dates end", "stays start", "stays end"]);
  });

  it("doesn't make the same change twice in one message", async () => {
    const { handlers, meter, byName } = bind();
    const input = { client_id: CLIENT_ID };

    await byName("trip_set_client").invoke(input);
    const again = JSON.parse((await byName("trip_set_client").invoke(input)) as string);

    expect(handlers.setClient).toHaveBeenCalledOnce();
    expect(again).toMatchObject({ unchanged: true, note: expect.stringMatching(/Already done/) });
    expect(meter.read().toolCalls.at(-1)).toMatchObject({ name: "trip_set_client", error_code: "repeated" });
  });

  it("still runs Undo twice, and retries a change that failed", async () => {
    const { handlers, byName } = bind();
    handlers.setDates.mockRejectedValueOnce(
      new AppError({ userMessage: "Stays sit outside.", code: "trips.leg_outside", status: 409 }),
    );

    await byName("trip_undo").invoke({});
    await byName("trip_undo").invoke({});
    await byName("trip_set_dates").invoke({ start: "12-10", end: "12-15" });
    await byName("trip_set_dates").invoke({ start: "12-10", end: "12-15" });

    expect(handlers.undo).toHaveBeenCalledTimes(2);
    expect(handlers.setDates).toHaveBeenCalledTimes(2);
  });

  it("asks before removing a stay only when it has the client's room", () => {
    const spec = findAgentTool("trip_remove_stay")!;
    const stay = { city: "Maldives", check_in: "2026-12-10", check_out: "2026-12-15", property_name: null, rate_selected: false };
    const trip = makeTripFacts({ stays: [stay] });

    expect(spec.confirm!({ city: "maldives" }, trip)).toBeNull();
    expect(spec.confirm!({ city: "maldives" }, { ...trip, stays: [{ ...stay, rate_selected: true }] })).toMatch(
      /pending booking will be cancelled/,
    );
  });

  it("offers a button per client when several match and the trip has no client", () => {
    const spec = findAgentTool("client_search")!;
    const hit = (id: string, display_name: string) => ({ id, display_name });
    const result = { clients: [hit(CLIENT_ID, "Aarav Mehta"), hit("c2", "Ria Mehta")] };

    expect(spec.choices!(result, makeTripFacts({ client: null }))).toEqual([
      { label: "Aarav Mehta", action: "trip_set_client", args: { client_id: CLIENT_ID } },
      { label: "Ria Mehta", action: "trip_set_client", args: { client_id: "c2" } },
    ]);
    expect(spec.choices!(result, makeTripFacts())).toEqual([]);
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
