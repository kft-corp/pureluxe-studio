import {
  computeContractedStayCost,
  contractedRateCoversStay,
  findActivePropertyById,
  listActiveContractedRatesForStay,
  listActivePropertyContractsForProperty,
  stayNightCount,
  type PropertyContract,
  type PropertyContractedRate,
} from "@pureluxe/db";

import { cancellationSummaryFromPolicies } from "../offline/contract-cancellation";
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

function toQuote(
  propertyId: string,
  propertyName: string | null,
  rate: PropertyContractedRate,
  checkIn: string,
  checkOut: string,
  adults: number,
  contracts: Map<string, PropertyContract>,
): RawRateInput {
  const contract = rate.contract_id ? contracts.get(rate.contract_id) : undefined;
  return {
    property_id: propertyId,
    property_name: propertyName,
    room_name: rate.room_category,
    board: rate.board,
    check_in: checkIn,
    check_out: checkOut,
    currency: rate.currency,
    cost_internal: computeContractedStayCost({
      rate,
      check_in: checkIn,
      check_out: checkOut,
      adults,
    }),
    rate_source_code: "offline_contracted",
    inclusions: benefitLines(rate),
    cancellation_summary: cancellationSummaryFromPolicies(contract?.policies),
    availability_status: "available",
    raw: {
      contracted_rate_id: rate.id,
      contract_id: rate.contract_id,
      cost_unit: rate.cost_unit,
      cost_amount: rate.cost_amount,
      package_nights: rate.package_nights,
      extra_night_amount: rate.extra_night_amount,
      nights: stayNightCount(checkIn, checkOut),
      rate_basis: rate.rate_basis,
      season_code: rate.season_code,
      min_nights: rate.min_nights,
      base_adults: rate.base_adults,
      base_children: rate.base_children,
      max_adults: rate.max_adults,
      max_children: rate.max_children,
      units_count: rate.units_count,
      notes: rate.notes,
    },
  };
}

/**
 * Layer 1 offline_contracted: one quote per covering room/package rate row.
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
      : await listActiveContractedRatesForStay({
          property_id: propertyId,
          check_in: request.check_in,
          check_out: request.check_out,
        });

  const nights = stayNightCount(request.check_in, request.check_out);
  const coveringStay = rates.filter((rate) =>
    contractedRateCoversStay(rate, nights),
  );

  if (coveringStay.length === 0) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message:
        rates.length === 0
          ? "No active contracted rate covers this stay."
          : `No contracted rate covers ${nights === 1 ? "1 night" : `${nights} nights`}.`,
    };
  }

  const [property, contracts] = await Promise.all([
    findActivePropertyById(propertyId),
    listActivePropertyContractsForProperty(propertyId),
  ]);
  const adults = request.adults > 0 ? request.adults : 2;
  const byId = new Map(contracts.map((contract) => [contract.id, contract]));

  return {
    source: "offline_contracted",
    status: "ok",
    quotes: coveringStay.map((rate) =>
      toQuote(
        propertyId,
        property?.name ?? null,
        rate,
        request.check_in,
        request.check_out,
        adults,
        byId,
      ),
    ),
  };
}
