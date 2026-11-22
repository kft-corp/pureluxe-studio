import { listActiveSupplierCodesForProperty } from "@pureluxe/db";
import { rateMessages } from "@pureluxe/shared";

import type { AdapterContext, AdapterResult } from "../../adapters/types";
import type { RawRateInput } from "../../results";
import type { RateSourceCode } from "../../types";
import {
  searchHotelDetailsByCode,
  searchHotelRatesByCode,
} from "./api";
import { SabreHttpError } from "./client";
import { isConfigured } from "./config";
import {
  classifySabreError,
  groupRoomOccupanciesForSabreShops,
  isBadHotelCodeResult,
  isNoInventoryResult,
  mergeSabreOccupancyShopQuotes,
  ratePlanMatchesRequested,
  readApplicationResults,
  sabreChildPricingHeadsUp,
  sabreEmptyTeamMessage,
  sabreErrorTeamMessage,
  sabreLog,
  sabreRatePlanCodesFromRows,
  validateStayDates,
  type RoomOccupancy,
  type SabreOccupancyShopGroup,
  type SearchHotelRatesStay,
} from "./helpers";
import {
  mapHotelDetailsToQuotes,
  mapHotelRatesToQuotes,
  mergeAvailAndDetailsQuotes,
  shortlistSabreQuotes,
} from "./mappers";

type GdsSource = Extract<RateSourceCode, "gds_public" | "gds_negotiated">;

type StayParty = SearchHotelRatesStay;

async function resolveHotelCode(input: {
  propertyId: string | null | undefined;
  supplierHotelCode?: string | null;
}): Promise<string | null> {
  // Mapped property codes win when present.
  if (input.propertyId) {
    const codes = await listActiveSupplierCodesForProperty(input.propertyId);
    const sabre = codes.find((row) => row.supplier_key === "sabre");
    const mapped = sabre?.supplier_property_code?.trim();
    if (mapped) return mapped;
  }
  // Stage 6 — open-GDS / off-list shop by code from shortlist.
  const open = input.supplierHotelCode?.trim();
  return open || null;
}

function emptyResult(source: GdsSource, message: string): AdapterResult {
  return {
    source,
    status: "empty",
    quotes: [],
    message,
  };
}

function stayInput(
  ctx: AdapterContext,
  override?: {
    adults?: number;
    children?: number;
    childAges?: number[];
    rooms?: number;
    roomOccupancies?: RoomOccupancy[];
  },
): StayParty {
  const infants = Math.max(0, Math.floor(ctx.request.infants ?? 0));
  const childrenOnly = Math.max(0, Math.floor(ctx.request.children ?? 0));
  // Sabre has no infant field — send infants as children with age 0.
  const childrenBase = childrenOnly + infants;
  const childAgesBase = [
    ...Array.from({ length: infants }, () => 0),
    ...(ctx.request.child_ages ?? []),
  ];
  const roomOccupancies = (
    override?.roomOccupancies ??
    (ctx.request.room_occupancies ?? []).map((row) => ({
      adults: row.adults,
      children: row.children,
      childAges: row.child_ages,
    }))
  ).filter((row) => row.adults >= 1);

  return {
    checkIn: ctx.request.check_in,
    checkOut: ctx.request.check_out,
    adults: override?.adults ?? ctx.request.adults,
    children: override?.children ?? childrenBase,
    childAges: override?.childAges ?? childAgesBase,
    rooms: override?.rooms ?? ctx.request.rooms,
    ...(roomOccupancies.length > 0 ? { roomOccupancies } : {}),
    currency: ctx.request.currency,
  };
}

/**
 * Keep negotiated shop results that match requested RatePlanCodes.
 * Rows with no plan code are kept (Sabre sometimes omits the field).
 */
function filterNegotiatedQuotes(
  quotes: RawRateInput[],
  ratePlanCodes: string[],
): RawRateInput[] {
  if (ratePlanCodes.length === 0) return [];
  return quotes.filter((quote) => {
    const plan = quote.raw?.rate_plan_code;
    if (typeof plan !== "string" || !plan.trim()) return true;
    return ratePlanMatchesRequested(plan, ratePlanCodes);
  });
}

/**
 * Enrich with GetHotelDetails (full room set + RateKey + cancel/payment + property times).
 * Merges with Avail; Details failure never drops usable Avail quotes.
 */
async function enrichWithDetails(options: {
  ctx: AdapterContext;
  source: GdsSource;
  hotelCode: string;
  propertyId: string | null;
  stay: StayParty;
  availQuotes: RawRateInput[];
  ratePlanCodes?: string[];
}): Promise<{ quotes: RawRateInput[]; response: unknown | null }> {
  const {
    ctx,
    source,
    hotelCode,
    propertyId,
    stay,
    availQuotes,
    ratePlanCodes,
  } = options;

  try {
    const detailsResponse = await searchHotelDetailsByCode({
      hotelCode,
      ...stay,
      ratePlanCodes,
    });

    const detailsQuotes = mapHotelDetailsToQuotes({
      response: detailsResponse,
      source,
      propertyId,
      checkIn: ctx.request.check_in,
      checkOut: ctx.request.check_out,
      currency: ctx.request.currency,
      hotelCode,
    });

    if (detailsQuotes.length === 0) {
      sabreLog.warn("details returned no mappable rates", {
        source,
        propertyId,
        hotelCode,
      });
      return { quotes: availQuotes, response: detailsResponse };
    }

    return {
      quotes: mergeAvailAndDetailsQuotes(availQuotes, detailsQuotes),
      response: detailsResponse,
    };
  } catch (err) {
    sabreLog.error("details enrichment failed — keeping avail", {
      source,
      propertyId,
      hotelCode,
      kind: classifySabreError(err),
      message: err instanceof Error ? err.message : String(err),
      status: err instanceof SabreHttpError ? err.status : undefined,
    });
    return { quotes: availQuotes, response: null };
  }
}

type ShopOnceResult = {
  quotes: RawRateInput[];
  responses: unknown[];
  appResult: ReturnType<typeof readApplicationResults>;
};

/** One uniform-pax Sabre Avail (+ Details) shop. */
async function shopSabreOnce(options: {
  ctx: AdapterContext;
  source: GdsSource;
  hotelCode: string;
  propertyId: string | null;
  stay: StayParty;
  ratePlanCodes: string[];
}): Promise<ShopOnceResult> {
  const { ctx, source, hotelCode, propertyId, stay, ratePlanCodes } = options;
  const responses: unknown[] = [];

  const availResponse = await searchHotelRatesByCode({
    hotelCodes: [hotelCode],
    ...stay,
    ratePlanCodes: source === "gds_negotiated" ? ratePlanCodes : undefined,
  });
  responses.push(availResponse);

  let quotes = mapHotelRatesToQuotes({
    response: availResponse,
    source,
    propertyId,
    checkIn: ctx.request.check_in,
    checkOut: ctx.request.check_out,
    currency: ctx.request.currency,
  });

  if (source === "gds_negotiated") {
    quotes = filterNegotiatedQuotes(quotes, ratePlanCodes);
  }

  const appResult = readApplicationResults(availResponse);

  if (quotes.length > 0) {
    const enriched = await enrichWithDetails({
      ctx,
      source,
      hotelCode,
      propertyId,
      stay,
      availQuotes: quotes,
      ratePlanCodes: source === "gds_negotiated" ? ratePlanCodes : undefined,
    });
    quotes = enriched.quotes;
    if (enriched.response) responses.push(enriched.response);
    if (source === "gds_negotiated") {
      quotes = filterNegotiatedQuotes(quotes, ratePlanCodes);
    }
  } else if (isNoInventoryResult(appResult)) {
    sabreLog.warn("avail no inventory — skipping details", {
      source,
      propertyId,
      hotelCode,
      status: appResult?.status,
      code: appResult?.code,
      message: appResult?.message,
    });
  } else if (isBadHotelCodeResult(appResult)) {
    sabreLog.warn("avail bad hotel code — skipping details", {
      source,
      propertyId,
      hotelCode,
      code: appResult?.code,
      message: appResult?.message,
    });
  } else {
    if (appResult) {
      sabreLog.warn("avail empty — trying details", {
        source,
        propertyId,
        hotelCode,
        status: appResult.status,
        severity: appResult.severity,
        code: appResult.code,
        message: appResult.message,
      });
    }
    const enriched = await enrichWithDetails({
      ctx,
      source,
      hotelCode,
      propertyId,
      stay,
      availQuotes: [],
      ratePlanCodes: source === "gds_negotiated" ? ratePlanCodes : undefined,
    });
    quotes = enriched.quotes;
    if (enriched.response) responses.push(enriched.response);
    if (source === "gds_negotiated") {
      quotes = filterNegotiatedQuotes(quotes, ratePlanCodes);
    }
  }

  return { quotes, responses, appResult };
}

function stayForOccupancyGroup(
  ctx: AdapterContext,
  group: SabreOccupancyShopGroup,
): StayParty {
  const adultsTotal = group.adults * group.rooms;
  const childrenTotal = group.children * group.rooms;
  const childAges = group.occupancies.flatMap((row) => row.childAges ?? []);
  return stayInput(ctx, {
    adults: adultsTotal,
    children: childrenTotal,
    childAges: childAges.length > 0 ? childAges : undefined,
    rooms: group.rooms,
    roomOccupancies: group.occupancies,
  });
}

/**
 * Sabre GDS adapter (Stage 3 + Stage 7 error / child heads-up):
 * - gds_public: Avail then Details (full rooms) when inventory exists
 * - gds_negotiated: same + RatePlanCandidates from active DB codes
 * - Uneven room_occupancies: separate uniform-pax shops, then merge totals
 * - Shortlist before return so UI/LLM never see the full Sabre dump
 */
export async function searchSabre(
  ctx: AdapterContext,
  source: GdsSource,
): Promise<AdapterResult> {
  if (!isConfigured()) {
    return {
      source,
      status: "stub",
      quotes: [],
      message: rateMessages.error.liveRatesUnavailable,
    };
  }

  const ratePlanCodes =
    source === "gds_negotiated"
      ? sabreRatePlanCodesFromRows(ctx.negotiated_rate_codes)
      : [];

  if (source === "gds_negotiated" && ratePlanCodes.length === 0) {
    return emptyResult(source, rateMessages.error.sabreNoNegotiatedCodes);
  }

  const stay = validateStayDates(
    ctx.request.check_in,
    ctx.request.check_out,
  );
  if (!stay.ok) {
    sabreLog.error("invalid stay dates", {
      source,
      propertyId: ctx.request.property_id ?? null,
      checkIn: ctx.request.check_in,
      checkOut: ctx.request.check_out,
      reason: stay.reason,
    });
    return emptyResult(
      source,
      source === "gds_negotiated"
        ? rateMessages.error.sabreNoNegotiatedAvailability
        : rateMessages.error.sabreNoAvailability,
    );
  }

  const propertyId = ctx.request.property_id ?? null;
  const supplierHotelCode = ctx.request.supplier_hotel_code ?? null;
  let hotelCode: string | null;
  try {
    hotelCode = await resolveHotelCode({
      propertyId,
      supplierHotelCode,
    });
  } catch (err) {
    const kind = classifySabreError(err);
    sabreLog.error("hotel code lookup failed", {
      source,
      propertyId,
      supplierHotelCode,
      kind,
      message: err instanceof Error ? err.message : String(err),
    });
    return emptyResult(source, sabreErrorTeamMessage(kind, source));
  }

  if (!hotelCode) {
    return emptyResult(source, rateMessages.error.sabreNoHotelCode);
  }

  const children = Math.max(0, Math.floor(ctx.request.children ?? 0));
  const baseStay = stayInput(ctx);
  const occupancyGroups =
    baseStay.roomOccupancies && baseStay.roomOccupancies.length > 0
      ? groupRoomOccupanciesForSabreShops(baseStay.roomOccupancies)
      : null;
  const needsMultiShop = (occupancyGroups?.length ?? 0) > 1;

  try {
    if (needsMultiShop && occupancyGroups) {
      sabreLog.warn("uneven occupancy — multi Sabre shop", {
        source,
        propertyId,
        hotelCode,
        groups: occupancyGroups.map((group) => ({
          adults: group.adults,
          children: group.children,
          rooms: group.rooms,
          roomIndexes: group.roomIndexes,
        })),
      });

      const groupShops = await Promise.all(
        occupancyGroups.map(async (group) => {
          const shopStay = stayForOccupancyGroup(ctx, group);
          const shopped = await shopSabreOnce({
            ctx,
            source,
            hotelCode,
            propertyId,
            stay: shopStay,
            ratePlanCodes,
          });
          return {
            group,
            quotes: shortlistSabreQuotes(shopped.quotes),
            responses: shopped.responses,
            appResult: shopped.appResult,
          };
        }),
      );

      const responsesForChildScan = groupShops.flatMap((row) => row.responses);
      const merged = mergeSabreOccupancyShopQuotes(
        groupShops.map((row) => ({
          group: row.group,
          quotes: row.quotes,
        })),
      );

      if (!merged.ok) {
        const labels = merged.emptyLabels.join("; ");
        sabreLog.warn("multi occupancy shop partial empty", {
          source,
          propertyId,
          hotelCode,
          emptyLabels: merged.emptyLabels,
        });
        return emptyResult(
          source,
          `${rateMessages.error.sabreMultiOccupancyPartial} (${labels})`,
        );
      }

      if (merged.quotes.length === 0) {
        const appResult = groupShops[0]?.appResult ?? null;
        return emptyResult(source, sabreEmptyTeamMessage(source, appResult));
      }

      const childHeadsUp = sabreChildPricingHeadsUp(
        children,
        responsesForChildScan,
      );
      const multiHeadsUp = rateMessages.warn.sabreMultiOccupancyShopped;
      const message = [multiHeadsUp, childHeadsUp].filter(Boolean).join(" ");

      return {
        source,
        status: "ok",
        quotes: shortlistSabreQuotes(merged.quotes),
        message: message || undefined,
      };
    }

    const shopped = await shopSabreOnce({
      ctx,
      source,
      hotelCode,
      propertyId,
      stay: baseStay,
      ratePlanCodes,
    });

    let quotes = shopped.quotes;
    if (quotes.length === 0) {
      sabreLog.warn("no rates after avail/details", {
        source,
        propertyId,
        hotelCode,
        ratePlanCodes:
          source === "gds_negotiated" ? ratePlanCodes : undefined,
      });
      return emptyResult(
        source,
        sabreEmptyTeamMessage(source, shopped.appResult),
      );
    }

    quotes = shortlistSabreQuotes(quotes);

    const childHeadsUp = sabreChildPricingHeadsUp(
      children,
      shopped.responses,
    );

    return {
      source,
      status: "ok",
      quotes,
      message: childHeadsUp ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "ROOM_OCCUPANCY_SPLIT_REQUIRED") {
      return emptyResult(source, rateMessages.error.roomOccupancySplitRequired);
    }
    if (
      message === "ROOM_OCCUPANCY_UNEVEN_SABRE" ||
      message === "SABRE_UNIFORM_PAX_REQUIRED"
    ) {
      return emptyResult(
        source,
        message === "ROOM_OCCUPANCY_UNEVEN_SABRE"
          ? rateMessages.error.roomOccupancyUneven
          : rateMessages.error.roomOccupancyNotDivisible,
      );
    }
    if (/at least one adult/i.test(message)) {
      return emptyResult(source, rateMessages.error.roomAdultsPerRoom);
    }
    const kind = classifySabreError(err);
    sabreLog.error("search failed", {
      source,
      propertyId,
      hotelCode,
      kind,
      message,
      status: err instanceof SabreHttpError ? err.status : undefined,
    });
    return emptyResult(
      source,
      sabreErrorTeamMessage(kind, source, {
        badHotelCode:
          kind === "http_4xx" &&
          /hotel.?code|invalid.?hotel/i.test(message),
      }),
    );
  }
}
