import { describe, expect, it } from "vitest";

import { buildComposerChips } from "@/components/trip-builder/build-composer-chips";
import type { TripBuilderChip } from "@/components/trip-builder/trip-builder-action-chip";
import { makeChipInput } from "@/tests/factories/composer-chips";
import { makeRate, makeStay, makeTripDetail } from "@/tests/factories/trips";

const SARAH = { id: "c1", display_name: "Sarah Chen" };

const SARAH_TRAVELLING = {
  client_id: "c1",
  display_name: "Sarah Chen",
  role: "primary" as const,
  party_role: "adult" as const,
  family_role: null,
};

const DUBAI = makeStay({
  leg_id: "leg-dubai",
  city: "Dubai",
  check_in: "2026-10-10",
  check_out: "2026-10-14",
  property_name: "Atlantis",
  adults: 2,
  children: 0,
  rooms: 1,
});

/** Client chosen, party not confirmed yet. */
const CLIENT_STAGE = makeTripDetail({
  client: SARAH,
  travellers: [SARAH_TRAVELLING],
});

/** Dates, stays, and hotel set. No room priced yet. */
const RATES_STAGE = makeTripDetail({
  client: SARAH,
  travellers: [SARAH_TRAVELLING],
  stays: [DUBAI],
  stay: DUBAI,
  trip: {
    travellers_confirmed_at: "2026-10-01T00:00:00.000Z",
    legs_confirmed_at: "2026-10-01T00:00:00.000Z",
    starts_on: "2026-10-10",
    ends_on: "2026-10-20",
  },
});

const DUBAI_DRAFT = {
  hotel: "Atlantis",
  city: "Dubai",
  checkIn: "2026-10-10",
  checkOut: "2026-10-14",
  adults: 2,
  children: 0,
  rooms: 1,
};

function ids(chips: TripBuilderChip[]): string[] {
  return chips.map((chip) => chip.id);
}

function chip(chips: TripBuilderChip[], id: string): TripBuilderChip {
  const found = chips.find((item) => item.id === id);
  if (!found) throw new Error(`No chip "${id}" in ${ids(chips).join(", ")}`);
  return found;
}

function leads(chips: TripBuilderChip[]): TripBuilderChip[] {
  return chips.filter((item) => item.variant === "primary" || item.variant === "danger");
}

describe("buildComposerChips", () => {
  describe("no trip open", () => {
    it("shows no chips on a fresh home screen", () => {
      expect(buildComposerChips(makeChipInput()).chips).toEqual([]);
    });

    it("turns the agent's choices into buttons", () => {
      const input = makeChipInput({
        replyCards: {
          choices: [{ label: "Create trip · Sarah Chen", action: "client_get", args: { client_id: "c1" } }],
        },
      });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["choice-0"]);
      expect(leads(chips)).toHaveLength(1);
      chips[0]!.onClick();
      expect(input.actions.sendAction).toHaveBeenCalledWith({
        action: "client_get",
        args: { client_id: "c1" },
        label: "Create trip · Sarah Chen",
      });
    });

    it("shows nothing without write access", () => {
      const { chips } = buildComposerChips(
        makeChipInput({
          canWrite: false,
          replyCards: { choices: [{ label: "Sarah Chen", action: "client_get", args: { client_id: "c1" } }] },
        }),
      );
      expect(chips).toEqual([]);
    });
  });

  describe("client stage", () => {
    it("offers the client's past trips", () => {
      const input = makeChipInput({ detail: CLIENT_STAGE });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["past-trips"]);
      chip(chips, "past-trips").onClick();
      expect(input.actions.sendAction).toHaveBeenCalledWith({
        action: "history_search_trips",
        args: { client_id: "c1" },
        label: "Past trips for Sarah Chen",
      });
    });
  });

  describe("agent cards", () => {
    it("shows only Confirm and Cancel while the agent waits for approval", () => {
      const input = makeChipInput({
        detail: RATES_STAGE,
        activeLegId: "leg-dubai",
        stayDraft: DUBAI_DRAFT,
        replyCards: { approval: "Move the trip 2 days later." },
      });
      const { chips, rateCards } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual(["Confirm", "Cancel"]);
      expect(chips[0]!.variant).toBe("danger");
      expect(rateCards).toEqual([]);

      chips[0]!.onClick();
      expect(input.actions.sendApproval).toHaveBeenCalledWith("approve");
      chips[1]!.onClick();
      expect(input.actions.sendApproval).toHaveBeenCalledWith("cancel");
    });

    it("turns the agent's choices into buttons that run its tool", () => {
      const input = makeChipInput({
        detail: makeTripDetail(),
        replyCards: {
          choices: [
            { label: "Sarah Chen", action: "trip_set_client", args: { client_id: "c1" } },
            { label: "Sam Chen", action: "trip_set_client", args: { client_id: "c9" } },
          ],
        },
      });
      const { chips } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual(["Sarah Chen", "Sam Chen"]);
      expect(leads(chips)).toHaveLength(1);
      chips[1]!.onClick();
      expect(input.actions.sendAction).toHaveBeenCalledWith({
        action: "trip_set_client",
        args: { client_id: "c9" },
        label: "Sam Chen",
      });
    });

    it("offers Undo after a change and hides the ready chips", () => {
      const input = makeChipInput({ detail: CLIENT_STAGE, replyCards: { undo: true } });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["undo"]);
      chips[0]!.onClick();
      expect(input.actions.sendAction).toHaveBeenCalledWith({ action: "trip_undo", label: "Undo" });
    });
  });

  describe("confirmations", () => {
    it("puts the yes chip first and its no chip right after", () => {
      const input = makeChipInput({
        detail: RATES_STAGE,
        activeLegId: "leg-dubai",
        stayDraft: DUBAI_DRAFT,
        offer: { type: "rate-search" },
      });
      const { chips } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual(["Search rates · 2 adults · 1 room", "Don't search"]);
      chips[1]!.onClick();
      expect(input.actions.declineOffer).toHaveBeenCalledOnce();
    });
  });

  describe("rates stage", () => {
    const ROOM = makeRate({
      id: "r1",
      leg_id: "leg-dubai",
      title: "Ocean Suite",
      subtitle: "Bed and breakfast",
      cost_internal: 3000,
      currency: "USD",
      inclusions: ["Breakfast", "Airport transfer"],
    });
    const WITH_ROOM = { ...RATES_STAGE, rates: { selected: null, candidates: [ROOM] } };

    it("offers a rate search with the party", () => {
      const input = makeChipInput({ detail: RATES_STAGE, activeLegId: "leg-dubai", stayDraft: DUBAI_DRAFT });
      const { chips } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual(["Search rates · 2 adults · 1 room"]);
      chips[0]!.onClick();
      expect(input.actions.searchRates).toHaveBeenCalledWith();
    });

    it("hides ready chips while the agent answers a question", () => {
      const { chips } = buildComposerChips(
        makeChipInput({
          detail: RATES_STAGE,
          activeLegId: "leg-dubai",
          stayDraft: DUBAI_DRAFT,
          quietChips: true,
        }),
      );
      expect(chips).toEqual([]);
    });

    it("turns saved rooms into rate cards", () => {
      const input = makeChipInput({ detail: WITH_ROOM, activeLegId: "leg-dubai", stayDraft: DUBAI_DRAFT });
      const { rateCards } = buildComposerChips(input);

      expect(rateCards).toHaveLength(1);
      expect(rateCards[0]).toMatchObject({
        id: "rate-cand-r1",
        index: 1,
        recommended: false,
        room: "Ocean Suite",
        board: "Bed and breakfast",
        price: "USD 3,000",
        inclusions: ["Breakfast", "Airport transfer"],
      });
      expect(rateCards[0]!.onAddToOptions).toBeUndefined();

      rateCards[0]!.onSelect!();
      expect(input.actions.offerSelectRoom).toHaveBeenCalledWith(
        { title: "Ocean Suite", kind: "saved", row: ROOM },
        "Client chose this",
      );
    });

    it("shows no rate cards once pricing is locked", () => {
      const { rateCards } = buildComposerChips(
        makeChipInput({ detail: { ...WITH_ROOM, pricing_locked: true }, activeLegId: "leg-dubai" }),
      );
      expect(rateCards).toEqual([]);
    });
  });
});
