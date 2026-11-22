import {
  getRateSourcesSetting,
  listActiveNegotiatedRateCodes,
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
import type { AdapterResult } from "../adapters/types";
import type {
  NormalizedRateOption,
  RateRoutingMeta,
  SearchRatesRequest,
  SearchRatesResult,
} from "../types";

function isOfflineSource(code: string): boolean {
  return code === "offline_manual" || code === "offline_contracted";
}

/** Prefer timeout / auth / bad-code style notes over generic empty copy. */
function pickAdapterTeamMessage(results: AdapterResult[]): string | null {
  const messages = results
    .map((row) => row.message?.trim())
    .filter((msg): msg is string => Boolean(msg));
  if (messages.length === 0) return null;

  const rank = (msg: string): number => {
    if (/timed out/i.test(msg)) return 0;
    if (/sign-in|credentials/i.test(msg)) return 1;
    if (
      /invalid or inactive|isn't mapped|GDS code|don't have live rates|can't pull live rates/i.test(
        msg,
      )
    ) {
      return 2;
    }
    if (/temporarily unavailable/i.test(msg)) return 3;
    if (/rejected this rate search/i.test(msg)) return 4;
    if (/No live GDS rates/i.test(msg)) return 5;
    if (/No special negotiated/i.test(msg)) return 6;
    return 7;
  };

  return [...messages].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Heads-ups from successful adapters only (skip empty-adapter noise). */
function pickOkAdapterMessages(results: AdapterResult[]): string | null {
  const messages = results
    .filter((row) => row.status === "ok")
    .map((row) => row.message?.trim())
    .filter((msg): msg is string => Boolean(msg));
  if (messages.length === 0) return null;
  return [...new Set(messages)].join(" ");
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

  const needsNegotiated = plan.steps.some(
    (step) => step.source === "gds_negotiated",
  );
  const negotiated_rate_codes = needsNegotiated
    ? await listActiveNegotiatedRateCodes()
    : [];

  const ran = await runAdapterPlan(plan, {
    request,
    contracted_rates: resolved.contracted_rates,
    wholesalers,
    negotiated_rate_codes,
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
      message: pickOkAdapterMessages(ran.results),
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
      message:
        pickAdapterTeamMessage(ran.results) ??
        rateMessages.error.liveRatesUnavailable,
      adapterResults: ran.results,
    });
  }

  return buildSearchRatesResult({
    status: "empty",
    options: [],
    routing,
    message:
      pickAdapterTeamMessage(ran.results) ?? rateMessages.error.noRatesFound,
    adapterResults: ran.results,
  });
}
