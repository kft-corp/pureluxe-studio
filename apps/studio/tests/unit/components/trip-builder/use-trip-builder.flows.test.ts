// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ChatStreamEvent, TripDetail } from "@/lib/trip-builder";

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
  showWarningToast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  addTripBuilderRateOption: vi.fn(),
  generateTripBuilderOptionsQuote: vi.fn(),
  getTripBuilderOptionsQuoteUrl: vi.fn(),
  getTripBuilderTrip: vi.fn(),
  listTripChatMessages: vi.fn(),
  listTripBuilderTrips: vi.fn(),
  pasteTripBuilderLineItem: vi.fn(),
  saveTripBuilderChatLines: vi.fn(),
  searchTripBuilderRates: vi.fn(),
  selectTripBuilderLineItem: vi.fn(),
  setTripBuilderStay: vi.fn(),
  streamPreTripChat: vi.fn(),
  streamTripChat: vi.fn(),
  updateTripBuilderQuote: vi.fn(),
  updateTripBuilderOptionsQuote: vi.fn(),
  proposeTripBuilderOptionsEdit: vi.fn(),
  updateTripBuilderStayOption: vi.fn(),
}));

import { useTripBuilder } from "@/components/trip-builder/use-trip-builder";
import * as apiModule from "@/lib/api";
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

function chatRow(role: ChatMessage["role"], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    kind: "text",
    content,
    incomplete: false,
    client_request_id: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

/** The next agent reply: these stream events, then the saved reply. */
function agentReplies(reply: Partial<ChatMessage>, events: ChatStreamEvent[] = []) {
  api.streamTripChat.mockImplementation(async (_tripId, body, handlers) => {
    handlers.onEvent({ type: "meta", user: chatRow("user", body.kind === "message" ? body.message : body.label) });
    for (const event of events) handlers.onEvent(event);
    handlers.onEvent({ type: "done", assistant: chatRow("assistant", "", reply) });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  nav.tripParam = null;
  api.listTripChatMessages.mockResolvedValue(ok({ messages: [], hasMore: false }));
  api.listTripBuilderTrips.mockResolvedValue(ok({ trips: [], total: 0 }));
  api.saveTripBuilderChatLines.mockResolvedValue(ok([]));
  api.streamTripChat.mockResolvedValue(undefined);
});

describe("useTripBuilder flows", () => {
  describe("agent", () => {
    it("sends a trip change to the agent as typed", async () => {
      const view = await openBuilder(planned([DUBAI]));

      await send(view, "Move Dubai to 11–15 Oct");

      expect(api.streamTripChat).toHaveBeenCalledWith(
        "trip-1",
        expect.objectContaining({ kind: "message", message: "Move Dubai to 11–15 Oct" }),
        expect.anything(),
      );
    });

    it("reloads the trip after the agent changes it, then offers Undo", async () => {
      const trip = planned([DUBAI]);
      const view = await openBuilder(trip);
      agentReplies({ content: "Dubai is now 11–15 Oct.", cards: { undo: true } }, [
        { type: "changed", summary: "Stays: Dubai" },
      ]);
      api.getTripBuilderTrip.mockClear();

      await send(view, "Move Dubai to 11–15 Oct");

      await waitFor(() => expect(api.getTripBuilderTrip).toHaveBeenCalledWith("trip-1"));
      expect(labels(view)).toEqual(["Undo"]);

      await tap(view, "Undo");
      expect(api.streamTripChat).toHaveBeenLastCalledWith(
        "trip-1",
        expect.objectContaining({ kind: "action", action: "trip_undo", label: "Undo" }),
        expect.anything(),
      );
    });

    it("answers the approval card when the advisor types yes", async () => {
      const view = await openBuilder(planned([DUBAI]));
      agentReplies({ content: "This moves every stay 2 days later.", cards: { approval: "Move the trip 2 days later." } });
      await send(view, "Push the whole trip by 2 days");
      expect(labels(view)).toEqual(["Confirm", "Cancel"]);

      await send(view, "yes");
      expect(api.streamTripChat).toHaveBeenLastCalledWith(
        "trip-1",
        expect.objectContaining({ kind: "resume", decision: "approve", label: "Confirm" }),
        expect.anything(),
      );
    });

    it("drops an open question when another trip opens", async () => {
      const tripA = planned([DUBAI]);
      const view = await openBuilder(tripA);
      await send(view, "search rates");
      expect(labels(view)).toContain("Don't search");

      const tripB = makeTripDetail({ ...tripA, trip: { ...tripA.trip, id: "trip-2" } });
      api.getTripBuilderTrip.mockResolvedValue(ok(tripB));
      nav.tripParam = "trip-2";
      view.rerender();
      await waitFor(() => expect(view.result.current.detail?.trip.id).toBe("trip-2"));
      await waitFor(() => expect(view.result.current.chatLoading).toBe(false));

      expect(labels(view)).not.toContain("Don't search");
      await send(view, "yes");
      expect(api.searchTripBuilderRates).not.toHaveBeenCalled();
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
