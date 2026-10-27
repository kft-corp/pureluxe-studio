import {
  findActivePropertyById,
  listActiveContractOffersForStay,
  listActiveContractedRatesOverlappingStay,
  listActivePropertyContractsForProperty,
  listActiveRateAddonsForStay,
  type PropertyContract,
  type PropertyContractedRate,
} from "@pureluxe/db";

import { cancellationSummaryFromPolicies } from "../offline/contract-cancellation";
import {
  contractAllowedForMarket,
  listPricableRoomCategories,
  priceContractedRoom,
} from "../pricing";
import type { RawRateInput } from "../results";
import type { AdapterContext, AdapterResult } from "./types";

function stringInclusions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function benefitLines(rate: PropertyContractedRate): string[] {
  const listed = stringInclusions(rate.inclusions);
  const flags = [
    rate.includes_breakfast ? "Breakfast" : null,
    rate.includes_lunch ? "Lunch" : null,
    rate.includes_dinner ? "Dinner" : null,
    rate.includes_transfer ? "Transfers" : null,
    rate.includes_green_tax ? "Green tax" : null,
  ].filter((item): item is string => Boolean(item));
  const seen = new Set(listed.map((item) => item.toLowerCase()));
  return [...listed, ...flags.filter((item) => !seen.has(item.toLowerCase()))];
}

/** One representative rate row per room category (for occupancy / board flags). */
function representativeRate(
  rates: PropertyContractedRate[],
  roomCategory: string | null,
): PropertyContractedRate | null {
  const matching = rates.filter(
    (rate) => (rate.room_category ?? null) === roomCategory,
  );
  if (matching.length === 0) return null;
  matching.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return matching[0] ?? null;
}

/**
 * Layer 1 offline_contracted: one all-in quote per room category the party fits,
 * priced night-by-night across seasons with rooms, children, extras, offers and tax.
 */
export async function searchOfflineContracted(
  ctx: AdapterContext,
): Promise<AdapterResult> {
  const { request } = ctx;
  const propertyId = request.property_id;

  if (!propertyId) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message: "No property_id — cannot load contracted rate.",
    };
  }

  const rates =
    ctx.contracted_rates && ctx.contracted_rates.length > 0
      ? ctx.contracted_rates
      : await listActiveContractedRatesOverlappingStay({
          property_id: propertyId,
          check_in: request.check_in,
          check_out: request.check_out,
        });

  if (rates.length === 0) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message: "No active contracted rate covers this stay.",
    };
  }

  const categories = listPricableRoomCategories(
    rates,
    request.check_in,
    request.check_out,
  );

  if (categories.length === 0) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message:
        "No contracted rate covers every night of this stay (including across seasons).",
    };
  }

  const [property, contracts, addons, offers] = await Promise.all([
    findActivePropertyById(propertyId),
    listActivePropertyContractsForProperty(propertyId),
    listActiveRateAddonsForStay({
      property_id: propertyId,
      check_in: request.check_in,
      check_out: request.check_out,
    }),
    listActiveContractOffersForStay({
      property_id: propertyId,
      check_in: request.check_in,
      check_out: request.check_out,
    }),
  ]);

  const byContractId = new Map(
    contracts.map((contract) => [contract.id, contract]),
  );
  const adults = request.adults > 0 ? request.adults : 2;
  const children = request.children ?? 0;
  const rooms = request.rooms && request.rooms > 0 ? request.rooms : 1;
  const clientMarkets = request.client_market_codes ?? [];

  const quotes: RawRateInput[] = [];
  let hiddenOccupancy = 0;
  let hiddenMarket = 0;

  for (const category of categories) {
    const roomCategory = category || null;
    const rate = representativeRate(rates, roomCategory);
    if (!rate) continue;

    const contract: PropertyContract | null = rate.contract_id
      ? (byContractId.get(rate.contract_id) ?? null)
      : null;

    if (
      contract &&
      !contractAllowedForMarket(contract.market_codes, clientMarkets)
    ) {
      hiddenMarket += 1;
      continue;
    }

    const priced = priceContractedRoom({
      rates,
      rate,
      contract,
      addons,
      offers,
      check_in: request.check_in,
      check_out: request.check_out,
      adults,
      children,
      rooms,
      child_ages: request.child_ages,
      client_market_codes: clientMarkets,
    });

    if (priced.status === "hidden") {
      if (priced.reason === "occupancy") hiddenOccupancy += 1;
      if (priced.reason === "market") hiddenMarket += 1;
      continue;
    }

    const price = priced.price;
    const offerNames = price.applied_offers.map((offer) => offer.name);
    const inclusions = [
      ...benefitLines(rate),
      ...offerNames.filter(
        (name) =>
          !benefitLines(rate).some(
            (line) => line.toLowerCase() === name.toLowerCase(),
          ),
      ),
    ];

    quotes.push({
      property_id: propertyId,
      property_name: property?.name ?? null,
      room_name: rate.room_category,
      board: rate.board,
      check_in: request.check_in,
      check_out: request.check_out,
      currency: rate.currency,
      cost_internal: price.cost_internal,
      rate_source_code: "offline_contracted",
      inclusions,
      cancellation_summary: cancellationSummaryFromPolicies(contract?.policies),
      availability_status: "available",
      raw: {
        contracted_rate_ids: price.rate_ids,
        contract_id: price.contract_id,
        rate_basis: rate.rate_basis,
        package_nights: rate.package_nights,
        extra_night_amount:
          rate.extra_night_amount == null ? null : Number(rate.extra_night_amount),
        season_codes: price.seasons,
        nights: price.nights,
        rooms: price.rooms,
        adults: price.adults,
        children: price.children,
        party_rooms: price.party_rooms,
        pricing_scope: price.scope,
        per_room: price.per_room,
        room_only: price.room_only,
        room_cost: price.room_cost,
        occupancy_extras: price.occupancy_extras,
        mandatory_extras: price.mandatory_extras,
        offers_discount: price.offers_discount,
        service_charge: price.service_charge,
        tax: price.tax,
        tax_percentage: contract?.tax_pct ?? null,
        taxes_included: contract?.taxes_included ?? false,
        applied_offers: price.applied_offers,
        applied_extras: price.applied_extras,
        child_ages_assumed: price.child_ages_assumed,
        needs_child_ages: price.needs_child_ages,
        base_adults: rate.base_adults,
        base_children: rate.base_children,
        max_adults: rate.max_adults,
        max_children: rate.max_children,
        notes: rate.notes,
      },
    });
  }

  if (quotes.length === 0) {
    const parts = [
      hiddenOccupancy > 0
        ? `${hiddenOccupancy} room${hiddenOccupancy === 1 ? "" : "s"} hidden — party does not fit`
        : null,
      hiddenMarket > 0
        ? `${hiddenMarket} rate${hiddenMarket === 1 ? "" : "s"} hidden — market does not match the client`
        : null,
    ].filter(Boolean);

    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message:
        parts.length > 0
          ? parts.join(". ") + "."
          : "No contracted rate covers this stay for the party.",
    };
  }

  const notes: string[] = [];
  if (hiddenOccupancy > 0) {
    notes.push(
      `${hiddenOccupancy} room${hiddenOccupancy === 1 ? "" : "s"} left out — the party does not fit`,
    );
  }
  if (hiddenMarket > 0) {
    notes.push(
      `${hiddenMarket} rate${hiddenMarket === 1 ? "" : "s"} left out — other market only`,
    );
  }
  if (quotes.some((quote) => quote.raw?.needs_child_ages === true)) {
    notes.push(
      "Child ages change the price on this contract — confirm ages if not already set",
    );
  } else if (quotes.some((quote) => quote.raw?.child_ages_assumed === true)) {
    notes.push("Child rate assumed (ages not on file)");
  }

  return {
    source: "offline_contracted",
    status: "ok",
    quotes,
    message: notes.length > 0 ? notes.join(". ") + "." : undefined,
  };
}
