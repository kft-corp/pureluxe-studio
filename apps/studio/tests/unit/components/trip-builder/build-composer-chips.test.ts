import { describe, expect, it } from "vitest";

import { buildComposerChips } from "@/components/trip-builder/build-composer-chips";
import type { TripBuilderChip } from "@/components/trip-builder/trip-builder-action-chip";
import { makeClientHit } from "@/tests/factories/clients";
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
  family_suggestions: [
    { client_id: "c2", display_name: "Ravi Chen", party_role: "child", family_role: "child" },
  ],
});

/** Party confirmed, no trip dates yet. */
const STAY_STAGE = makeTripDetail({
  client: SARAH,
  travellers: [SARAH_TRAVELLING],
  trip: { travellers_confirmed_at: "2026-10-01T00:00:00.000Z" },
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
    it("offers Create trip, then a chip per suggested client", () => {
      const input = makeChipInput({ suggestedClients: [SARAH] });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["create-trip", "draft-client-c1"]);
      expect(chip(chips, "draft-client-c1").label).toBe("Create trip · Sarah Chen");

      chip(chips, "draft-client-c1").onClick();
      expect(input.actions.createTrip).toHaveBeenCalledWith("c1", "Sarah Chen");
    });

    it("shows nothing without write access", () => {
      const { chips } = buildComposerChips(makeChipInput({ canWrite: false, suggestedClients: [SARAH] }));
      expect(chips).toEqual([]);
    });
  });

  describe("client stage", () => {
    it("offers household members, then the party-done chip, then past trips", () => {
      const input = makeChipInput({ detail: CLIENT_STAGE });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["family-c2", "travellers-set", "past-trips"]);
      expect(chips.map((item) => item.label)).toEqual([
        "Add Ravi Chen",
        "Only Sarah Chen is travelling",
        "Past trips for Sarah Chen",
      ]);

      chip(chips, "family-c2").onClick();
      expect(input.actions.addTraveller).toHaveBeenCalledWith(
        { id: "c2", display_name: "Ravi Chen", party_role: "child" },
        "Add Ravi Chen",
      );

      chip(chips, "past-trips").onClick();
      expect(input.actions.sendTripAction).toHaveBeenCalledWith({
        action: "history_search_trips",
        args: { client_id: "c1" },
        label: "Past trips for Sarah Chen",
      });
    });

    it("leads with the party-done chip when there is no household", () => {
      const { chips } = buildComposerChips(
        makeChipInput({ detail: { ...CLIENT_STAGE, family_suggestions: [] } }),
      );
      expect(ids(chips)).toEqual(["travellers-set", "past-trips"]);
      expect(chip(chips, "travellers-set").variant).toBe("primary");
    });

    it("hands a searched client to chooseClient", () => {
      const hit = makeClientHit(SARAH);
      const input = makeChipInput({ detail: makeTripDetail(), clientHits: [hit] });
      const { chips } = buildComposerChips(input);

      expect(chip(chips, "client-c1").label).toBe("Choose Sarah Chen");
      chip(chips, "client-c1").onClick();
      expect(input.actions.chooseClient).toHaveBeenCalledWith(hit);
    });
  });

  describe("confirmations", () => {
    it("puts Save trip dates first and its no chip right after", () => {
      const dates = { checkIn: "2026-10-10", checkOut: "2026-10-20" };
      const input = makeChipInput({
        detail: STAY_STAGE,
        offer: { type: "trip-dates", dates },
      });
      const { chips } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual([
        "Save trip dates · 10 Oct – 20 Oct · 10 nights",
        "Keep current dates",
      ]);

      chips[0]!.onClick();
      expect(input.actions.saveTripDates).toHaveBeenCalledWith(dates);

      chips[1]!.onClick();
      expect(input.actions.declineOffer).toHaveBeenCalledOnce();
    });

    it("labels a trip shift with the new dates and marks it as danger", () => {
      const input = makeChipInput({ detail: RATES_STAGE, offer: { type: "shift-trip", days: 2 } });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["shift-trip", "decline"]);
      expect(chips[0]).toMatchObject({
        label: "Shift every stay · 12 Oct – 22 Oct · 10 nights",
        variant: "danger",
      });

      chips[0]!.onClick();
      expect(input.actions.commitShift).toHaveBeenCalledWith(2);
    });

    it("asks before removing a stay", () => {
      const target = { legId: "leg-dubai", city: "Dubai" };
      const input = makeChipInput({
        detail: RATES_STAGE,
        offer: { type: "remove-stay", leg: target },
      });
      const { chips } = buildComposerChips(input);

      expect(chips.map((item) => item.label)).toEqual(["Remove Dubai", "Keep this stay"]);
      chips[0]!.onClick();
      expect(input.actions.commitRemove).toHaveBeenCalledWith(target);
    });

    it("keeps only one lead chip when two primaries are offered", () => {
      const { chips } = buildComposerChips(
        makeChipInput({
          detail: STAY_STAGE,
          leadHits: [makeClientHit({ id: "c3", display_name: "Ravi Mehta" })],
          offer: { type: "trip-dates", dates: { checkIn: "2026-10-10", checkOut: "2026-10-20" } },
        }),
      );

      expect(ids(chips)).toEqual(["lead-hit-c3", "decline", "save-trip-dates"]);
      expect(leads(chips)).toHaveLength(1);
      expect(chip(chips, "save-trip-dates").variant).toBe("secondary");
    });
  });

  describe("locked pricing", () => {
    it("offers to reopen the quote", () => {
      const input = makeChipInput({ detail: { ...RATES_STAGE, pricing_locked: true }, offerReopen: true });
      const { chips } = buildComposerChips(input);

      expect(ids(chips)).toEqual(["reopen-quote"]);
      chips[0]!.onClick();
      expect(input.actions.openTripPage).toHaveBeenCalled();
    });

    it("hides stay edits", () => {
      const { chips } = buildComposerChips(
        makeChipInput({
          detail: { ...RATES_STAGE, pricing_locked: true },
          offer: { type: "shift-trip", days: 2 },
        }),
      );
      expect(ids(chips)).not.toContain("shift-trip");
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
