import {
  getRateSourcesSetting,
  listActiveWholesalersForProfile,
} from "@pureluxe/db";
import { rateMessages } from "@pureluxe/shared";

import { runAdapterPlan } from "../adapters";
import { checkOfflineAvailability } from "../offline";
import {
  buildAdapterPlan,
  resolveDestinationProfile,
  resolveRoutingLayer,
} from "../resolve";
import {
  buildSearchRatesResult,
  normalizeRate,
  rankAndRecommend,
} from "../results";
import type {
  NormalizedRateOption,
  RateRoutingMeta,
  SearchRatesRequest,
  SearchRatesResult,
} from "../types";

function isOfflineSource(code: string): boolean {
  return code === "offline_manual" || code === "offline_contracted";
}

/**
 * After offline quotes, run availability check and annotate options.
 */
async function applyOfflineAvailability(
  options: NormalizedRateOption[],
  request: SearchRatesRequest,
  setting: Awaited<ReturnType<typeof getRateSourcesSetting>>,
): Promise<NormalizedRateOption[]> {
  const next: NormalizedRateOption[] = [];

  for (const option of options) {
    if (!isOfflineSource(option.rate_source_code)) {
      next.push(option);
      continue;
    }

    const check = await checkOfflineAvailability({
      property_id: option.property_id ?? request.property_id,
      check_in: request.check_in,
      check_out: request.check_out,
      setting,
    });

    let availability_status = option.availability_status;
    if (check.status === "available" || check.status === "unavailable") {
      availability_status = check.status;
    } else if (check.status === "unknown") {
      availability_status = "unknown";
    }

    next.push({
      ...option,
      availability_status,
      raw: {
        ...option.raw,
        availability_check: check.status,
        availability_message: check.message,
      },
    });
  }

  return next;
}

/**
 * Main Rate Layer entry: profile → layer → plan → adapters → normalize → rank.
 * Always returns the same SearchRatesResult envelope (null / [] when empty).
 */
export async function searchRatesForLeg(
  request: SearchRatesRequest,
): Promise<SearchRatesResult> {
  const setting = await getRateSourcesSetting();
  const destination = await resolveDestinationProfile(request.destination_text);

  const resolved = await resolveRoutingLayer({
    property_id: request.property_id,
    check_in: request.check_in,
    check_out: request.check_out,
    profile: destination.profile,
  });

  const wholesalers = destination.profile
    ? await listActiveWholesalersForProfile(destination.profile.id)
    : [];

  const plan = buildAdapterPlan({
    routing: resolved,
    setting,
    wholesalers,
  });

  const ran = await runAdapterPlan(plan, {
    request,
    contracted_rates: resolved.contracted_rates,
    wholesalers,
  });

  const routing: RateRoutingMeta = {
    layer: resolved.layer,
    pattern: resolved.pattern,
    destination_type: resolved.destination_type,
    destination_profile_id: resolved.destination_profile_id,
    sources_tried: ran.results.map((result) => result.source),
  };

  const normalizeDefaults = {
    check_in: request.check_in,
    check_out: request.check_out,
    currency: request.currency ?? setting.default_currency,
    property_id: request.property_id ?? null,
  };

  const normalized = ran.quotes.map((quote) =>
    normalizeRate(quote, normalizeDefaults),
  );
  const withAvailability = await applyOfflineAvailability(
    normalized,
    request,
    setting,
  );

  const ranked = rankAndRecommend(
    withAvailability,
    setting,
    resolved.pattern,
  );

  if (ranked.length > 0) {
    return buildSearchRatesResult({
      status: "ok",
      options: ranked,
      routing,
      message: null,
      adapterResults: ran.results,
    });
  }

  if (
    ran.needs_paste ||
    plan.requires_offline_paste ||
    resolved.pattern === "offline_only"
  ) {
    return buildSearchRatesResult({
      status: "consultant_required",
      options: [],
      routing,
      message: rateMessages.error.offlineQuoteRequired,
      adapterResults: ran.results,
    });
  }

  if (ran.had_stub) {
    return buildSearchRatesResult({
      status: "stub",
      options: [],
      routing,
      message: rateMessages.error.liveRatesUnavailable,
      adapterResults: ran.results,
    });
  }

  return buildSearchRatesResult({
    status: "empty",
    options: [],
    routing,
    message: rateMessages.error.noRatesFound,
    adapterResults: ran.results,
  });
}
