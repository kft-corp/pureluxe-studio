import type {
  PropertyContract,
  PropertyContractOffer,
  PropertyContractedRate,
  PropertyRateAddon,
} from "@pureluxe/db";

import { stayNights, roundMoney } from "./dates";
import {
  childAgesAffectPrice,
  mandatoryExtraCharges,
  occupancyExtraCharges,
  type AppliedExtra,
} from "./extras";
import { contractAllowedForMarket } from "./market";
import {
  applyQualifyingOffers,
  applyTransferDiscount,
  type AppliedOffer,
} from "./offers";
import {
  partyFitsRate,
  splitPartyAcrossRooms,
  type PartyRoom,
} from "./party";
import { computeRoomStayCost } from "./room-cost";
import { applyServiceChargeAndTax } from "./tax";

export type PriceScope = "per_room" | "total";

export type ContractedAllInPrice = {
  /** All-in team cost for the stay (all rooms). */
  cost_internal: number;
  /** Same figure when rooms === 1; otherwise total ÷ rooms for display. */
  per_room: number;
  scope: PriceScope;
  rooms: number;
  nights: number;
  adults: number;
  children: number;
  party_rooms: PartyRoom[];
  room_cost: number;
  occupancy_extras: number;
  mandatory_extras: number;
  offers_discount: number;
  service_charge: number;
  tax: number;
  room_only: number;
  applied_offers: AppliedOffer[];
  applied_extras: AppliedExtra[];
  rate_ids: string[];
  seasons: string[];
  child_ages_assumed: boolean;
  needs_child_ages: boolean;
  contract_id: string | null;
};

export type PriceContractedRoomInput = {
  rates: PropertyContractedRate[];
  /** Representative rate row for occupancy / board / inclusions flags. */
  rate: PropertyContractedRate;
  contract: PropertyContract | null;
  addons: PropertyRateAddon[];
  offers: PropertyContractOffer[];
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  child_ages?: number[] | null;
  client_market_codes?: string[] | null;
  book_as_of?: string;
};

export type PriceContractedRoomResult =
  | { status: "ok"; price: ContractedAllInPrice }
  | { status: "hidden"; reason: "occupancy" | "market" | "no_rate" };

/**
 * All-in price for one room category: party split, night-by-night room cost,
 * occupancy extras, mandatory charges, offers, service charge and tax
 * (Stage 3b / R1, R2, R9, R10, R11, R12).
 */
export function priceContractedRoom(
  input: PriceContractedRoomInput,
): PriceContractedRoomResult {
  if (
    input.contract &&
    !contractAllowedForMarket(
      input.contract.market_codes,
      input.client_market_codes,
    )
  ) {
    return { status: "hidden", reason: "market" };
  }

  const roomsRequested = Math.max(1, Math.floor(input.rooms) || 1);
  const adults = Math.max(1, Math.floor(input.adults) || 1);
  const children = Math.max(0, Math.floor(input.children) || 0);

  const { rooms: partyRooms, child_ages_assumed } = splitPartyAcrossRooms({
    adults,
    children,
    rooms: roomsRequested,
    child_ages: input.child_ages,
  });

  if (!partyFitsRate(input.rate, partyRooms)) {
    return { status: "hidden", reason: "occupancy" };
  }

  const needs_child_ages =
    children > 0 &&
    childAgesAffectPrice(input.addons) &&
    (input.child_ages == null ||
      input.child_ages.length < children ||
      child_ages_assumed);

  const nights = stayNights(input.check_in, input.check_out).length;
  if (nights <= 0) return { status: "hidden", reason: "no_rate" };

  let roomCostTotal = 0;
  let occupancyExtrasTotal = 0;
  const rateIds = new Set<string>();
  const seasons = new Set<string>();
  const occupancyExtras: AppliedExtra[] = [];

  for (const room of partyRooms) {
    const base = computeRoomStayCost({
      rates: input.rates,
      room_category: input.rate.room_category,
      check_in: input.check_in,
      check_out: input.check_out,
      adults: Math.max(room.adults, 1),
    });
    if (!base) return { status: "hidden", reason: "no_rate" };

    roomCostTotal += base.cost;
    for (const id of base.rate_ids) rateIds.add(id);
    for (const season of base.seasons) seasons.add(season);

    const extras = occupancyExtraCharges({
      addons: input.addons,
      rate: input.rate,
      room,
      check_in: input.check_in,
      check_out: input.check_out,
      contract_id: input.rate.contract_id,
    });
    for (const extra of extras) {
      occupancyExtras.push(extra);
      occupancyExtrasTotal += extra.amount;
    }
  }

  roomCostTotal = roundMoney(roomCostTotal);
  occupancyExtrasTotal = roundMoney(occupancyExtrasTotal);
  const roomOnlyBeforeOffers = roundMoney(roomCostTotal + occupancyExtrasTotal);

  const { room_after_offers, applied: appliedOffers } = applyQualifyingOffers({
    offers: input.offers,
    room_cost: roomOnlyBeforeOffers,
    room_category: input.rate.room_category,
    check_in: input.check_in,
    check_out: input.check_out,
    contract_id: input.rate.contract_id,
    book_as_of: input.book_as_of,
  });

  const offersDiscount = roundMoney(roomOnlyBeforeOffers - room_after_offers);
  const transferDiscount = Math.max(
    0,
    ...appliedOffers.map((offer) => offer.transfer_discount_percent),
  );

  let mandatory = mandatoryExtraCharges({
    addons: input.addons,
    rate: input.rate,
    rooms: partyRooms,
    check_in: input.check_in,
    check_out: input.check_out,
    contract_id: input.rate.contract_id,
    room_count: roomsRequested,
  });
  mandatory = applyTransferDiscount(mandatory, transferDiscount);
  const mandatoryTotal = roundMoney(
    mandatory.reduce((sum, row) => sum + row.amount, 0),
  );

  const net = roundMoney(room_after_offers + mandatoryTotal);
  const taxParts = applyServiceChargeAndTax({
    net,
    taxes_included: input.contract?.taxes_included ?? false,
    service_charge_pct: input.contract?.service_charge_pct ?? null,
    tax_pct: input.contract?.tax_pct ?? null,
    tax_on_service_charge: input.contract?.tax_on_service_charge ?? true,
  });

  const scope: PriceScope = roomsRequested > 1 ? "total" : "per_room";
  const perRoom =
    roomsRequested > 1
      ? roundMoney(taxParts.all_in / roomsRequested)
      : taxParts.all_in;

  return {
    status: "ok",
    price: {
      cost_internal: taxParts.all_in,
      per_room: perRoom,
      scope,
      rooms: roomsRequested,
      nights,
      adults,
      children,
      party_rooms: partyRooms,
      room_cost: roomCostTotal,
      occupancy_extras: occupancyExtrasTotal,
      mandatory_extras: mandatoryTotal,
      offers_discount: offersDiscount,
      service_charge: taxParts.service_charge,
      tax: taxParts.tax,
      room_only: roomOnlyBeforeOffers,
      applied_offers: appliedOffers,
      applied_extras: [...occupancyExtras, ...mandatory],
      rate_ids: [...rateIds],
      seasons: [...seasons],
      child_ages_assumed,
      needs_child_ages,
      contract_id: input.rate.contract_id,
    },
  };
}
