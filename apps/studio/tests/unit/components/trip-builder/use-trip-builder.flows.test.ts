// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TripDetail } from "@/lib/trip-builder";

const nav = vi.hoisted(() => ({
  tripParam: null as string | null,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  useSearchParams: () => ({ get: (key: string) => (key === "trip" ? nav.tripParam : null) }),
}));

vi.mock("@/lib/feedback", () => ({
  showApiError: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  addTripBuilderLeg: vi.fn(),
  removeTripBuilderLeg: vi.fn(),
  updateTripBuilderLeg: vi.fn(),
  addTripBuilderRateOption: vi.fn(),
  createTripBuilderTrip: vi.fn(),
  generateTripBuilderOptionsQuote: vi.fn(),
  getTripBuilderOptionsQuoteUrl: vi.fn(),
  getTripBuilderTrip: vi.fn(),
  listTripChatMessages: vi.fn(),
  listTripBuilderTrips: vi.fn(),
  pasteTripBuilderLineItem: vi.fn(),
  searchClients: vi.fn(),
  removeTripBuilderTraveller: vi.fn(),
  saveTripBuilderChatLines: vi.fn(),
  saveTripBuilderTraveller: vi.fn(),
  askTripBuilderAtlas: vi.fn(),
  searchTripBuilderRates: vi.fn(),
  selectTripBuilderLineItem: vi.fn(),
  setTripBuilderStay: vi.fn(),
  shiftTripBuilderDates: vi.fn(),
  streamPreTripChat: vi.fn(),
  streamTripChat: vi.fn(),
  updateTripBuilderQuote: vi.fn(),
  updateTripBuilderOptionsQuote: vi.fn(),
  proposeTripBuilderOptionsEdit: vi.fn(),
  updateTripBuilderStayOption: vi.fn(),
  updateTripBuilderTrip: vi.fn(),
}));

import { useTripBuilder } from "@/components/trip-builder/use-trip-builder";
import * as apiModule from "@/lib/api";
import { makeClientHit } from "@/tests/factories/clients";
import { makeRate, makeStay, makeTripDetail } from "@/tests/factories/trips";

const api = vi.mocked(apiModule);

function ok<T>(data: T) {
  return { success: true, data, message: "" } as never;
}

const SARAH = { id: "c1", display_name: "Sarah Chen" };
const SARAH_LEAD = {
  client_id: "c1",
  display_name: "Sarah Chen",
  role: "primary" as const,
  party_role: "adult" as const,
  family_role: null,
};
const RAVI_HIT = makeClientHit({ id: "c2", display_name: "Ravi Chen" });
const RAVI_COMPANION = {
  client_id: "c2",
  display_name: "Ravi Chen",
  role: "companion" as const,
  party_role: "adult" as const,
  family_role: null,
};
const CONFIRMED = "2026-10-01T00:00:00.000Z";

const DUBAI = makeStay({
  leg_id: "leg-dubai",
  city: "Dubai",
  check_in: "2026-10-10",
  check_out: "2026-10-14",
  property_id: "prop-atlantis",
  property_name: "Atlantis",
  adults: 1,
  children: 0,
  rooms: 1,
});
const MUSCAT = makeStay({
  leg_id: "leg-muscat",
  city: "Muscat",
  check_in: "2026-10-14",
  check_out: "2026-10-18",
});
const MUSCAT_BOOKED = {
  ...MUSCAT,
  property_id: "prop-shangri",
  property_name: "Shangri-La",
  adults: 1,
  children: 0,
  rooms: 1,
};
const OCEAN_SUITE = makeRate({
  id: "r1",
  leg_id: "leg-dubai",
  title: "Ocean Suite",
  cost_internal: 3000,
  currency: "USD",
});

/** Party set, no trip dates. */
const NO_DATES = makeTripDetail({
  client: SARAH,
  travellers: [SARAH_LEAD],
  trip: { travellers_confirmed_at: CONFIRMED },
});

/** Dates set, stays still being listed. */
function listing(stays = [DUBAI]): TripDetail {
  return makeTripDetail({
    client: SARAH,
    travellers: [SARAH_LEAD],
    stays,
    stay: stays[0] ?? null,
    trip: { travellers_confirmed_at: CONFIRMED, starts_on: "2026-10-10", ends_on: "2026-10-20" },
  });
}

/** Stays listed and planned. */
function planned(stays: TripDetail["stays"], candidates: TripDetail["rates"]["candidates"] = []): TripDetail {
  return makeTripDetail({
    client: SARAH,
    travellers: [SARAH_LEAD],
    stays,
    stay: stays[0] ?? null,
    rates: { selected: null, candidates },
    trip: {
      travellers_confirmed_at: CONFIRMED,
      legs_confirmed_at: CONFIRMED,
      starts_on: "2026-10-10",
      ends_on: "2026-10-20",
    },
  });
}

/** Client chosen, party still open. */
function partyOpen(travellers: TripDetail["travellers"] = [SARAH_LEAD]): TripDetail {
  return makeTripDetail({ client: SARAH, travellers });
}

function withDates(detail: TripDetail, starts_on: string, ends_on: string): TripDetail {
  return { ...detail, trip: { ...detail.trip, starts_on, ends_on } };
}

async function openBuilder(detail: TripDetail) {
  nav.tripParam = detail.trip.id;
  api.getTripBuilderTrip.mockResolvedValue(ok(detail));
  const view = renderHook(() =>
    useTripBuilder({ initialTrips: [], initialDetail: detail, canWrite: true }),
  );
  await waitFor(() => expect(view.result.current.chatLoading).toBe(false));
  return view;
}

type View = Awaited<ReturnType<typeof openBuilder>>;

function labels(view: View): string[] {
  return view.result.current.chips.map((chip) => chip.label);
}

function lastReply(view: View): string | undefined {
  return view.result.current.messages.at(-1)?.content;
}

async function settle(view: View) {
  await waitFor(() => expect(view.result.current.busy).toBe(false));
}

async function send(view: View, text: string) {
  await act(async () => {
    await view.result.current.handleSend(text);
  });
  await settle(view);
}

async function tap(view: View, label: string | RegExp) {
  const chip = view.result.current.chips.find((item) =>
    typeof label === "string" ? item.label === label : label.test(item.label),
  );
  if (!chip) throw new Error(`No chip ${String(label)} in: ${labels(view).join(" | ")}`);
  await act(async () => {
    chip.onClick();
  });
  await settle(view);
}

beforeEach(() => {
  vi.resetAllMocks();
  nav.tripParam = null;
  api.listTripChatMessages.mockResolvedValue(ok({ messages: [], hasMore: false }));
  api.listTripBuilderTrips.mockResolvedValue(ok({ trips: [], total: 0 }));
  api.saveTripBuilderChatLines.mockResolvedValue(ok([]));
  api.streamTripChat.mockResolvedValue(undefined);
  api.searchClients.mockResolvedValue(ok({ clients: [] }));
  api.askTripBuilderAtlas.mockResolvedValue(
    ok({ matched: false, answer: "", place: { city: null, country: null }, hotels: [] }),
  );
});

describe("useTripBuilder flows", () => {
  describe("trip dates", () => {
    it("asks before saving the trip dates, and saves on yes", async () => {
      const view = await openBuilder(NO_DATES);
      api.updateTripBuilderTrip.mockResolvedValue(ok(withDates(NO_DATES, "2026-10-10", "2026-10-20")));

      await send(view, "Start: 2026-10-10\nEnd: 2026-10-20");
      expect(labels(view)).toEqual([
        "Save trip dates · 10 Oct – 20 Oct · 10 nights",
        "Keep current dates",
      ]);

      await send(view, "yes");
      expect(api.updateTripBuilderTrip).toHaveBeenCalledWith(NO_DATES.trip.id, {
        starts_on: "2026-10-10",
        ends_on: "2026-10-20",
        drop_outside_legs: undefined,
      });
      expect(labels(view)).toEqual([]);
    });

    it("leaves no question behind after the Save trip dates chip", async () => {
      const view = await openBuilder(NO_DATES);
      api.updateTripBuilderTrip.mockResolvedValue(ok(withDates(NO_DATES, "2026-10-10", "2026-10-20")));

      await send(view, "Start: 2026-10-10\nEnd: 2026-10-20");
      await tap(view, /^Save trip dates/);

      expect(api.updateTripBuilderTrip).toHaveBeenCalledTimes(1);
      expect(labels(view)).toEqual([]);
    });

    it("keeps the dates on no", async () => {
      const view = await openBuilder(NO_DATES);

      await send(view, "Start: 2026-10-10\nEnd: 2026-10-20");
      await send(view, "no");

      expect(api.updateTripBuilderTrip).not.toHaveBeenCalled();
      expect(lastReply(view)).toBe("Okay. The trip dates stay as they are.");
      expect(labels(view)).toEqual([]);
    });

    it("names stays outside the new dates and removes them on yes", async () => {
      const outside = makeStay({ leg_id: "leg-late", city: "Muscat", check_in: "2026-10-16", check_out: "2026-10-19" });
      const trip = listing([outside]);
      const view = await openBuilder(trip);
      api.updateTripBuilderTrip.mockResolvedValue(ok(withDates(listing([]), "2026-10-10", "2026-10-15")));

      await send(view, "Start: 2026-10-10\nEnd: 2026-10-15");
      expect(labels(view)).toEqual(["Remove outside stays and save dates", "Keep current dates"]);

      await send(view, "yes");
      expect(api.updateTripBuilderTrip).toHaveBeenCalledWith(trip.trip.id, {
        starts_on: "2026-10-10",
        ends_on: "2026-10-15",
        drop_outside_legs: true,
      });
      expect(labels(view)).not.toContain("Keep current dates");
    });

    it("shifts every stay after the chip", async () => {
      const trip = listing();
      const view = await openBuilder(trip);
      api.shiftTripBuilderDates.mockResolvedValue(ok(withDates(trip, "2026-10-12", "2026-10-22")));

      await send(view, "shift the trip by 2 days");
      expect(labels(view)).toEqual([
        "Shift every stay · 12 Oct – 22 Oct · 10 nights",
        "Keep current dates",
      ]);

      await tap(view, /^Shift every stay/);
      expect(api.shiftTripBuilderDates).toHaveBeenCalledWith(trip.trip.id, { days: 2 });
      expect(labels(view)).not.toContain("Keep current dates");
    });

    it("drops an open question when another trip opens", async () => {
      const tripA = listing();
      const view = await openBuilder(tripA);
      await send(view, "shift the trip by 2 days");
      expect(labels(view)).toContain("Keep current dates");

      const tripB = makeTripDetail({ ...listing(), trip: { ...listing().trip, id: "trip-2" } });
      api.getTripBuilderTrip.mockResolvedValue(ok(tripB));
      nav.tripParam = "trip-2";
      view.rerender();
      await waitFor(() => expect(view.result.current.detail?.trip.id).toBe("trip-2"));
      await waitFor(() => expect(view.result.current.chatLoading).toBe(false));

      expect(labels(view)).not.toContain("Keep current dates");
      await send(view, "yes");
      expect(api.shiftTripBuilderDates).not.toHaveBeenCalled();
    });
  });

  describe("stays", () => {
    it("asks before adding a stay", async () => {
      const trip = listing([]);
      const view = await openBuilder(trip);
      api.addTripBuilderLeg.mockResolvedValue(ok({ detail: listing([MUSCAT]), leg_id: "leg-muscat" }));

      await send(view, "add Muscat 2026-10-14 2026-10-18");
      expect(labels(view)).toEqual(["Add Muscat · 14 Oct – 18 Oct · 4 nights", "Don't add"]);

      await tap(view, /^Add Muscat/);
      expect(api.addTripBuilderLeg).toHaveBeenCalledWith(trip.trip.id, {
        city: "Muscat",
        check_in: "2026-10-14",
        check_out: "2026-10-18",
        confirm_overlap: false,
      });
      expect(labels(view)).not.toContain("Don't add");
    });

    it("asks before removing a stay", async () => {
      const trip = listing();
      const view = await openBuilder(trip);
      api.removeTripBuilderLeg.mockResolvedValue(ok(listing([])));

      await send(view, "remove Dubai");
      expect(labels(view)).toEqual(["Remove Dubai", "Keep this stay"]);

      await send(view, "yes");
      expect(api.removeTripBuilderLeg).toHaveBeenCalledWith(trip.trip.id, "leg-dubai");
      expect(labels(view)).not.toContain("Keep this stay");
    });

    it("keeps a stay as it is on no", async () => {
      const view = await openBuilder(listing());

      await send(view, "Dubai 2026-10-11 2026-10-15");
      expect(labels(view)).toEqual(["Update Dubai", "Keep stay as is"]);

      await send(view, "no");
      expect(api.updateTripBuilderLeg).not.toHaveBeenCalled();
      expect(lastReply(view)).toBe("Okay. That stay stays as it is.");
      expect(labels(view)).toEqual(["Plan these stays"]);
    });

    it("warns about overlapping nights, then saves anyway with no question left", async () => {
      const trip = planned([DUBAI, MUSCAT]);
      const view = await openBuilder(trip);
      api.setTripBuilderStay.mockResolvedValue(
        ok({ detail: planned([DUBAI, MUSCAT_BOOKED]), property_match: { status: "linked", names: [] } }),
      );
      act(() => view.result.current.selectLeg("leg-muscat"));

      await send(view, "Hotel: Shangri-La\nCheck-in: 2026-10-12\nCheck-out: 2026-10-16\nRooms: 1");
      expect(labels(view)).toEqual(["Update stay · Shangri-La", "Keep stay as is"]);

      await tap(view, "Update stay · Shangri-La");
      expect(api.setTripBuilderStay).not.toHaveBeenCalled();
      expect(labels(view)).toEqual(["Save stay anyway", "Don't save"]);

      await tap(view, "Save stay anyway");
      expect(api.setTripBuilderStay).toHaveBeenCalledWith(
        trip.trip.id,
        expect.objectContaining({ leg_id: "leg-muscat", confirm_overlap: true }),
      );
      expect(labels(view)).not.toContain("Don't save");
    });
  });

  describe("travellers", () => {
    it("confirms the party when they type just them", async () => {
      const trip = partyOpen();
      const view = await openBuilder(trip);
      api.saveTripBuilderTraveller.mockResolvedValue(
        ok({ ...trip, trip: { ...trip.trip, travellers_confirmed_at: CONFIRMED } }),
      );

      await send(view, "just them");
      expect(api.saveTripBuilderTraveller).toHaveBeenCalledWith(trip.trip.id, { confirm: true });
    });

    it("does not read a party line as a city before the trip dates are set", async () => {
      const view = await openBuilder(partyOpen());
      api.searchClients.mockResolvedValue(ok({ clients: [RAVI_HIT] }));

      await send(view, "add Ravi");
      expect(lastReply(view)).not.toMatch(/^Set the trip start and end first/);
      expect(api.searchClients).toHaveBeenCalledWith({ q: "Ravi", limit: 8 });
    });

    it("does not offer a party line as the first stay", async () => {
      const view = await openBuilder(listing([]));

      await send(view, "add Ravi");
      expect(labels(view)).not.toContain("Don't add");
      expect(lastReply(view)).not.toMatch(/for the whole trip/);
    });

    it("asks before adding a traveller", async () => {
      const trip = partyOpen();
      const view = await openBuilder(trip);
      api.searchClients.mockResolvedValue(ok({ clients: [RAVI_HIT] }));
      api.saveTripBuilderTraveller.mockResolvedValue(ok(partyOpen([SARAH_LEAD, RAVI_COMPANION])));

      await send(view, "add Ravi");
      expect(labels(view)).toEqual(["Add Ravi Chen", "Don't add"]);

      await send(view, "yes");
      expect(api.saveTripBuilderTraveller).toHaveBeenCalledWith(trip.trip.id, {
        client_id: "c2",
        party_role: "adult",
      });
      expect(labels(view)).not.toContain("Don't add");
    });

    it("keeps the lead on no", async () => {
      const view = await openBuilder(partyOpen());
      api.searchClients.mockResolvedValue(ok({ clients: [RAVI_HIT] }));

      await send(view, "make Ravi the lead");
      expect(labels(view)).toEqual(["Make Ravi Chen the lead", "Keep current lead"]);

      await send(view, "no");
      expect(api.saveTripBuilderTraveller).not.toHaveBeenCalled();
      expect(lastReply(view)).toBe("Okay. The lead stays as it is.");
    });

    it("changes a traveller to a child after the chip", async () => {
      const trip = partyOpen([SARAH_LEAD, RAVI_COMPANION]);
      const view = await openBuilder(trip);
      api.saveTripBuilderTraveller.mockResolvedValue(
        ok(partyOpen([SARAH_LEAD, { ...RAVI_COMPANION, party_role: "child" }])),
      );

      await send(view, "make Ravi a child");
      expect(labels(view)).toEqual(["Make Ravi Chen a child", "Keep as is"]);

      await tap(view, "Make Ravi Chen a child");
      expect(api.saveTripBuilderTraveller).toHaveBeenCalledWith(trip.trip.id, {
        client_id: "c2",
        party_role: "child",
      });
      expect(labels(view)).not.toContain("Keep as is");
    });

    it("asks before putting a searched client on the trip", async () => {
      const trip = makeTripDetail();
      const view = await openBuilder(trip);
      api.searchClients.mockResolvedValue(ok({ clients: [makeClientHit(SARAH)] }));
      api.updateTripBuilderTrip.mockResolvedValue(ok(partyOpen()));

      await send(view, "add Sarah Chen");
      await waitFor(() => expect(labels(view)).toContain("Choose Sarah Chen"));

      await tap(view, "Choose Sarah Chen");
      expect(labels(view)).toEqual(["Add Sarah Chen as the client", "Don't add"]);

      await send(view, "yes");
      expect(api.updateTripBuilderTrip).toHaveBeenCalledWith(trip.trip.id, { primary_client_id: "c1" });
    });

    it("keeps the client question open when saving the client fails", async () => {
      const view = await openBuilder(makeTripDetail());
      api.searchClients.mockResolvedValue(ok({ clients: [makeClientHit(SARAH)] }));
      api.updateTripBuilderTrip.mockRejectedValue(new Error("Network down"));

      await send(view, "add Sarah Chen");
      await waitFor(() => expect(labels(view)).toContain("Choose Sarah Chen"));
      await tap(view, "Choose Sarah Chen");
      await send(view, "yes");

      expect(labels(view)).toEqual(["Add Sarah Chen as the client", "Don't add"]);
    });
  });

  describe("rates and the quote", () => {
    beforeEach(() => {
      api.searchTripBuilderRates.mockResolvedValue(
        ok({
          options: [],
          message: null,
          stay_notes: null,
          hotel_brief: null,
          rate_context: null,
          recommended: null,
          sources_tried: [],
        }),
      );
    });

    it("asks before searching rates", async () => {
      const trip = planned([DUBAI]);
      const view = await openBuilder(trip);

      await send(view, "search rates");
      expect(labels(view)).toEqual(["Search rates · 1 adults · 1 room", "Don't search"]);

      await send(view, "yes");
      expect(api.searchTripBuilderRates).toHaveBeenCalledWith(
        expect.objectContaining({ trip_id: trip.trip.id, leg_id: "leg-dubai", rooms: 1 }),
      );
      expect(labels(view)).not.toContain("Don't search");
    });

    it("drops an open rate search when another stay opens", async () => {
      const view = await openBuilder(planned([DUBAI, MUSCAT_BOOKED]));

      await send(view, "search rates");
      expect(labels(view)).toContain("Don't search");

      act(() => view.result.current.selectLeg("leg-muscat"));
      expect(labels(view)).not.toContain("Don't search");

      await send(view, "yes");
      expect(api.searchTripBuilderRates).not.toHaveBeenCalled();
    });

    it("uses a pasted quote after the chip", async () => {
      const view = await openBuilder(planned([DUBAI]));
      api.pasteTripBuilderLineItem.mockResolvedValue(ok({ id: "li-1" }));
      api.selectTripBuilderLineItem.mockResolvedValue(ok({ id: "li-1" }));

      await send(view, "Atlantis total USD 3000");
      expect(labels(view)).toEqual(["Use pasted quote", "Don't use"]);

      await tap(view, "Use pasted quote");
      expect(api.pasteTripBuilderLineItem).toHaveBeenCalledWith(
        expect.objectContaining({ leg_id: "leg-dubai", paste_text: "Atlantis total USD 3000" }),
      );
      expect(api.selectTripBuilderLineItem).toHaveBeenCalledWith("li-1");
      expect(labels(view)).not.toContain("Don't use");
    });

    it("keeps the pasted quote on offer when saving it fails", async () => {
      const view = await openBuilder(planned([DUBAI]));
      api.pasteTripBuilderLineItem.mockRejectedValue(new Error("Network down"));

      await send(view, "Atlantis total USD 3000");
      await tap(view, "Use pasted quote");

      expect(labels(view)).toContain("Use pasted quote");
    });

    it("asks before setting the trip client price", async () => {
      const chosen = { ...OCEAN_SUITE, selected: true, sell_amount: 4000 };
      const trip = planned([DUBAI], [chosen]);
      const view = await openBuilder(trip);
      api.updateTripBuilderQuote.mockResolvedValue(ok({ detail: trip, quote: trip.quote }));

      await send(view, "sell 4500 USD");
      expect(labels(view)).toEqual(["Set client price · USD 4,500", "Keep current price"]);

      await send(view, "yes");
      expect(api.updateTripBuilderQuote).toHaveBeenCalledWith(trip.trip.id, {
        sell_total: 4500,
        sell_currency: "USD",
      });
      expect(labels(view)).not.toContain("Keep current price");
    });

    it("asks before setting a room's client price", async () => {
      const trip = planned([DUBAI], [OCEAN_SUITE]);
      const view = await openBuilder(trip);
      api.updateTripBuilderStayOption.mockResolvedValue(ok(trip));

      await send(view, "client price 2400 USD for Ocean Suite");
      expect(labels(view)).toEqual(["Set price · Ocean Suite · USD 2,400", "Don't save"]);

      await send(view, "yes");
      expect(api.updateTripBuilderStayOption).toHaveBeenCalledWith("r1", { sell_amount: 2400 });
      expect(labels(view)).not.toContain("Don't save");
    });

    it("asks before recording the client's room", async () => {
      const view = await openBuilder(planned([DUBAI], [OCEAN_SUITE]));
      api.selectTripBuilderLineItem.mockResolvedValue(ok({ id: "r1" }));

      act(() => view.result.current.offerChooseSaved("r1"));
      expect(labels(view)).toEqual(["Client chose · Ocean Suite", "Not yet"]);

      await send(view, "yes");
      expect(api.selectTripBuilderLineItem).toHaveBeenCalledWith("r1");
      expect(labels(view)).not.toContain("Not yet");
    });

    it("asks before changing the options quote title", async () => {
      const trip = planned([DUBAI], [OCEAN_SUITE]);
      const view = await openBuilder(trip);
      api.updateTripBuilderOptionsQuote.mockResolvedValue(ok(trip));

      await send(view, "options title: Maldives escape");
      expect(labels(view)).toEqual(["Set options title", "Keep wording"]);

      await send(view, "yes");
      expect(api.updateTripBuilderOptionsQuote).toHaveBeenCalledWith(trip.trip.id, {
        title: "Maldives escape",
      });
    });

    it("asks before changing a line on the options quote", async () => {
      const trip = planned([DUBAI], [OCEAN_SUITE]);
      const view = await openBuilder(trip);
      api.proposeTripBuilderOptionsEdit.mockResolvedValue(
        ok({
          kind: "matches",
          matches: [{ id: "line-1", label: "Ocean Suite", text: "Breakfast", after: "Half board" }],
        }),
      );
      api.updateTripBuilderOptionsQuote.mockResolvedValue(ok(trip));

      await send(view, "change breakfast to half board");
      expect(labels(view)).toEqual(["Change this line", "Keep as is"]);

      await send(view, "yes");
      expect(api.updateTripBuilderOptionsQuote).toHaveBeenCalledWith(trip.trip.id, {
        line_edits: [{ id: "line-1", text: "Half board" }],
      });
    });

    it("does not open the options quote on no", async () => {
      const view = await openBuilder(planned([DUBAI], [OCEAN_SUITE]));

      await send(view, "show the options quote");
      expect(labels(view)).toEqual(["Open options quote", "Not now"]);

      await send(view, "no");
      expect(api.generateTripBuilderOptionsQuote).not.toHaveBeenCalled();
      expect(lastReply(view)).toBe("Okay. I won't open the options quote.");
    });
  });
});
