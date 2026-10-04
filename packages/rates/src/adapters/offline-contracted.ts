import {
  computeContractedStayCost,
  findActivePropertyById,
  listActiveContractedRatesForStay,
  type PropertyContractedRate,
} from "@pureluxe/db";

import type { RawRateInput } from "../results";
import type { AdapterContext, AdapterResult } from "./types";

function stringInclusions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toQuote(
  propertyId: string,
  propertyName: string | null,
  rate: PropertyContractedRate,
  checkIn: string,
  checkOut: string,
  adults: number,
): RawRateInput {
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
    inclusions: stringInclusions(rate.inclusions),
    availability_status: "available",
    raw: {
      contracted_rate_id: rate.id,
      contract_id: rate.contract_id,
      cost_unit: rate.cost_unit,
      rate_basis: rate.rate_basis,
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

  if (rates.length === 0) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message: "No active contracted rate covers this stay.",
    };
  }

  const property = await findActivePropertyById(propertyId);
  const adults = request.adults > 0 ? request.adults : 2;

  return {
    source: "offline_contracted",
    status: "ok",
    quotes: rates.map((rate) =>
      toQuote(
        propertyId,
        property?.name ?? null,
        rate,
        request.check_in,
        request.check_out,
        adults,
      ),
    ),
  };
}
