import {
  findActiveContractedRateForStay,
  findActivePropertyById,
} from "@pureluxe/db";

import type { AdapterContext, AdapterResult } from "./types";

/**
 * Real adapter: read active contracted rate covering the stay from DB.
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

  const contracted =
    ctx.contracted_rate ??
    (await findActiveContractedRateForStay({
      property_id: propertyId,
      check_in: request.check_in,
      check_out: request.check_out,
    }));

  if (!contracted) {
    return {
      source: "offline_contracted",
      status: "empty",
      quotes: [],
      message: "No active contracted rate covers this stay.",
    };
  }

  const property = await findActivePropertyById(propertyId);

  return {
    source: "offline_contracted",
    status: "ok",
    quotes: [
      {
        property_id: propertyId,
        property_name: property?.name ?? null,
        board: contracted.board,
        check_in: request.check_in,
        check_out: request.check_out,
        currency: contracted.currency,
        cost_internal: Number(contracted.cost_amount),
        rate_source_code: "offline_contracted",
        inclusions: Array.isArray(contracted.inclusions)
          ? contracted.inclusions.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        availability_status: "available",
        raw: { contracted_rate_id: contracted.id },
      },
    ],
  };
}
