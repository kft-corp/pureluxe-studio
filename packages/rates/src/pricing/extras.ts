import type { PropertyRateAddon } from "@pureluxe/db";

import { coversNight, roundMoney, stayNights } from "./dates";
import type { PartyRoom } from "./party";

export type AppliedExtra = {
  name: string;
  amount: number;
  addon_type: string;
};

function ageMatches(
  age: number | null,
  ageFrom: number | null,
  ageTo: number | null,
): boolean {
  if (age == null) {
    // No age: only match open-ended adult bands (age_from set, no upper bound),
    // or bands with no age limits at all.
    if (ageFrom == null && ageTo == null) return true;
    if (ageFrom != null && ageTo == null) return true;
    return false;
  }
  if (ageFrom != null && age < ageFrom) return false;
  if (ageTo != null && age > ageTo) return false;
  return true;
}

function roomCategoryMatches(
  appliesTo: unknown,
  roomCategory: string | null,
): boolean {
  if (!Array.isArray(appliesTo) || appliesTo.length === 0) return true;
  const names = appliesTo
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase());
  if (names.length === 0) return true;
  if (names.includes("*")) return true;
  if (!roomCategory) return false;
  return names.includes(roomCategory.trim().toLowerCase());
}

function boardMatches(
  boardRequired: string | null,
  board: string | null,
): boolean {
  if (!boardRequired?.trim()) return true;
  if (!board?.trim()) return false;
  return boardRequired.trim().toLowerCase() === board.trim().toLowerCase();
}

function quantityForUnit(
  unit: PropertyRateAddon["unit"],
  people: number,
  nights: number,
  rooms: number,
): number {
  switch (unit) {
    case "per_person":
      return people;
    case "per_person_per_night":
      return people * nights;
    case "per_night":
      return nights;
    case "per_villa_per_night":
      return rooms * nights;
    case "per_event":
    case "per_stay":
      return 1;
    default:
      return 1;
  }
}

/**
 * Extra adult / child charges for one room beyond base occupancy (R12).
 */
export function occupancyExtraCharges(input: {
  addons: PropertyRateAddon[];
  rate: {
    base_adults: number;
    base_children: number;
    board: string | null;
    room_category: string | null;
    includes_green_tax: boolean;
  };
  room: PartyRoom;
  check_in: string;
  check_out: string;
  contract_id: string | null;
}): AppliedExtra[] {
  const nights = stayNights(input.check_in, input.check_out).length;
  if (nights <= 0) return [];

  const extraAdults = Math.max(0, input.room.adults - Math.max(0, input.rate.base_adults));
  const includedChildren = Math.max(0, input.rate.base_children);
  const extraChildAges = input.room.child_ages.slice(includedChildren);

  const applied: AppliedExtra[] = [];
  const addons = input.addons.filter(
    (addon) =>
      (input.contract_id == null ||
        addon.contract_id == null ||
        addon.contract_id === input.contract_id) &&
      roomCategoryMatches(addon.applies_to_room_categories, input.rate.room_category) &&
      boardMatches(addon.board_required, input.rate.board),
  );

  if (extraAdults > 0) {
    const adultAddon = addons.find((addon) => addon.addon_type === "extra_adult");
    if (adultAddon) {
      const amount =
        Number(adultAddon.amount) *
        quantityForUnit(adultAddon.unit, extraAdults, nights, 1);
      if (Number.isFinite(amount) && amount > 0) {
        applied.push({
          name: adultAddon.name,
          amount: roundMoney(amount),
          addon_type: adultAddon.addon_type,
        });
      }
    }
  }

  for (const age of extraChildAges) {
    const childAddon = addons.find(
      (addon) =>
        addon.addon_type === "extra_child" &&
        ageMatches(age, addon.age_from, addon.age_to),
    );
    if (!childAddon) continue;
    const amount =
      Number(childAddon.amount) *
      quantityForUnit(childAddon.unit, 1, nights, 1);
    if (Number.isFinite(amount) && amount > 0) {
      applied.push({
        name: `${childAddon.name} (age ${age})`,
        amount: roundMoney(amount),
        addon_type: childAddon.addon_type,
      });
    }
  }

  return applied;
}

/**
 * Required charges for the party (green tax, festive, …) — R2.
 * Skips green tax when the rate already includes it.
 */
export function mandatoryExtraCharges(input: {
  addons: PropertyRateAddon[];
  rate: {
    board: string | null;
    room_category: string | null;
    includes_green_tax: boolean;
    includes_transfer: boolean;
  };
  rooms: PartyRoom[];
  check_in: string;
  check_out: string;
  contract_id: string | null;
  room_count: number;
}): AppliedExtra[] {
  const nightsList = stayNights(input.check_in, input.check_out);
  const nights = nightsList.length;
  if (nights <= 0) return [];

  const people: { age: number | null }[] = [];
  for (const room of input.rooms) {
    for (let i = 0; i < room.adults; i++) people.push({ age: 30 });
    for (const age of room.child_ages) people.push({ age });
  }

  const applied: AppliedExtra[] = [];
  const mandatory = input.addons.filter(
    (addon) =>
      addon.mandatory &&
      (input.contract_id == null ||
        addon.contract_id == null ||
        addon.contract_id === input.contract_id) &&
      roomCategoryMatches(addon.applies_to_room_categories, input.rate.room_category) &&
      boardMatches(addon.board_required, input.rate.board),
  );

  for (const addon of mandatory) {
    if (addon.addon_type === "green_tax" && input.rate.includes_green_tax) {
      continue;
    }
    if (addon.addon_type === "transfer" && input.rate.includes_transfer) {
      continue;
    }

    // Date-banded mandatory (festive): charge only for overlapping nights / events.
    const nightHits = nightsList.filter((night) =>
      coversNight(addon.valid_from, addon.valid_to, night),
    );
    if (addon.valid_from != null || addon.valid_to != null) {
      if (nightHits.length === 0) continue;
    }

    let matchingPeople = people.filter((person) =>
      ageMatches(person.age, addon.age_from, addon.age_to),
    ).length;
    if (
      addon.unit !== "per_person" &&
      addon.unit !== "per_person_per_night"
    ) {
      matchingPeople = Math.max(matchingPeople, 1);
    }
    if (
      (addon.unit === "per_person" || addon.unit === "per_person_per_night") &&
      matchingPeople === 0
    ) {
      continue;
    }

    const effectiveNights =
      addon.unit === "per_person_per_night" ||
      addon.unit === "per_night" ||
      addon.unit === "per_villa_per_night"
        ? nightHits.length > 0
          ? nightHits.length
          : nights
        : nights;

    const amount =
      Number(addon.amount) *
      quantityForUnit(
        addon.unit,
        matchingPeople,
        effectiveNights,
        input.room_count,
      );

    if (Number.isFinite(amount) && amount !== 0) {
      applied.push({
        name: addon.name,
        amount: roundMoney(amount),
        addon_type: addon.addon_type,
      });
    }
  }

  return applied;
}

/**
 * True when child age bands on the contract would change the price (Fix 8).
 * Ages are only worth asking for when bands differ.
 */
export function childAgesAffectPrice(addons: PropertyRateAddon[]): boolean {
  const banded = addons.filter(
    (addon) =>
      (addon.addon_type === "extra_child" ||
        addon.addon_type === "green_tax" ||
        addon.addon_type === "festive" ||
        addon.addon_type === "transfer") &&
      (addon.age_from != null || addon.age_to != null),
  );
  if (banded.length === 0) return false;

  const bands = new Set(
    banded.map((addon) => `${addon.age_from ?? ""}:${addon.age_to ?? ""}`),
  );
  return bands.size > 1 || banded.some((addon) => addon.addon_type === "extra_child");
}
