import { describe, expect, it } from "vitest";

import { fastForwardTrip, newEvalTrip } from "@/tests/ai/eval/eval-trip";
import { createSeedHandlers } from "@/tests/ai/eval/seed-handlers";
import { MEHTA_CLIENT_IDS, MEHTA_MALDIVES_SEED } from "@/tests/ai/fixtures/mehta-maldives";
import { pickClient } from "@/tests/ai/scenarios/mehta-maldives";

function setUp(withClient = true) {
  const trip = newEvalTrip("trip-1");
  if (withClient) fastForwardTrip(trip, pickClient.expect.trip, MEHTA_MALDIVES_SEED);
  return { trip, handlers: createSeedHandlers(MEHTA_MALDIVES_SEED, trip, "2026-10-19") };
}

describe("seed handlers", () => {
  it("finds every Mehta on file", async () => {
    const { handlers } = setUp(false);
    const { clients } = await handlers.searchClients({ query: "Mehta" });
    expect(clients.map((client) => client.display_name)).toEqual([
      "Aarav Mehta",
      "Anika Mehta",
      "Ravi Mehta",
      "Priya Mehta",
      "Kabir Mehta",
    ]);
  });

  it("loads the trip's lead client with their household", async () => {
    const { handlers } = setUp();
    const client = await handlers.getClient({});
    expect(client).toMatchObject({ id: MEHTA_CLIENT_IDS.aarav, tier: { label: "Gold" } });
    expect(client.family?.members.map((member) => member.display_name)).toEqual(["Aarav Mehta", "Anika Mehta"]);
  });

  it("asks for a client id before a client is on the trip", async () => {
    const { handlers } = setUp(false);
    await expect(handlers.getClient({})).rejects.toMatchObject({ code: "ai.client_required" });
  });

  it("builds trip facts from the fast-forwarded trip", async () => {
    const { handlers } = setUp();
    const trip = await handlers.getTrip();
    expect(trip).toMatchObject({
      client: { display_name: "Aarav Mehta" },
      starts_on: "2026-12-10",
      ends_on: "2026-12-15",
      travellers: [
        { display_name: "Aarav Mehta", role: "primary", party_role: "adult" },
        { display_name: "Anika Mehta", role: "companion", party_role: "adult" },
      ],
      stays: [expect.objectContaining({ city: "Maldives" })],
    });
  });

  it("matches hotels by alias and shows the contract terms", async () => {
    const { handlers } = setUp();
    const { hotels } = await handlers.getHotel({ name: "Kanuhura" });
    expect(hotels).toHaveLength(1);
    expect(hotels[0]?.facts).toContain("Free cancellation until 30 days before arrival");
  });

  it("returns place notes for the country or one of its hotels, and nothing for unknown places", async () => {
    const { handlers } = setUp();
    expect(await handlers.getPlaceNotes({ query: "visa for the Maldives" })).toMatchObject({ matched: true });
    expect(await handlers.getPlaceNotes({ query: "Soneva Fushi" })).toMatchObject({ matched: true });
    expect(await handlers.getPlaceNotes({ query: "Iceland" })).toEqual({ matched: false, notes: null, hotels: [] });
  });
});
