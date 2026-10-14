import type { AdapterPlan } from "../resolve";
import type { RawRateInput } from "../results";
import type { RateSourceCode } from "../types";
import { searchHotelbeds } from "./hotelbeds";
import { searchOfflineContracted } from "./offline-contracted";
import { searchOfflineManual } from "./offline-manual";
import { searchSabre } from "./sabre";
import type { AdapterContext, AdapterResult } from "./types";
import { searchWholesale } from "./wholesale";

export type RunAdapterPlanResult = {
  quotes: RawRateInput[];
  results: AdapterResult[];
  /** At least one live supplier returned stub. */
  had_stub: boolean;
  /** Offline manual was planned but paste was missing. */
  needs_paste: boolean;
  messages: string[];
};

function hasUsableQuotes(quotes: RawRateInput[]): boolean {
  return quotes.some(
    (quote) => (quote.availability_status ?? "unknown") !== "unavailable",
  );
}

async function runStep(
  source: RateSourceCode,
  ctx: AdapterContext,
): Promise<AdapterResult> {
  switch (source) {
    case "offline_contracted":
      return searchOfflineContracted(ctx);
    case "offline_manual":
      return searchOfflineManual(ctx);
    case "gds_public":
      return searchSabre(ctx, "gds_public");
    case "gds_negotiated":
      return searchSabre(ctx, "gds_negotiated");
    case "ota_bedbank":
      return searchHotelbeds(ctx);
    case "wholesale":
      return searchWholesale(ctx);
    default: {
      const _exhaustive: never = source;
      return {
        source: _exhaustive,
        status: "empty",
        quotes: [],
        message: `Unknown rate source: ${String(source)}`,
      };
    }
  }
}

async function collect(
  steps: AdapterPlan["steps"],
  ctx: AdapterContext,
  state: {
    results: AdapterResult[];
    quotes: RawRateInput[];
    messages: string[];
    had_stub: boolean;
    needs_paste: boolean;
    ranSources: Set<RateSourceCode>;
  },
): Promise<void> {
  for (const step of steps) {
    if (state.ranSources.has(step.source)) continue;
    state.ranSources.add(step.source);

    const result = await runStep(step.source, ctx);
    state.results.push(result);

    if (result.message) state.messages.push(result.message);
    if (result.status === "stub") state.had_stub = true;
    if (result.status === "needs_paste") state.needs_paste = true;

    state.quotes.push(...result.quotes);
  }
}

/**
 * Execute planned sources with primary → fallback short-circuit.
 * - Run all `primary` steps.
 * - Run `fallback` only when primary produced no usable quotes.
 * - Always run `always_surface` (e.g. negotiated) if not already tried.
 */
export async function runAdapterPlan(
  plan: AdapterPlan,
  ctx: AdapterContext,
): Promise<RunAdapterPlanResult> {
  const state = {
    results: [] as AdapterResult[],
    quotes: [] as RawRateInput[],
    messages: [] as string[],
    had_stub: false,
    needs_paste: false,
    ranSources: new Set<RateSourceCode>(),
  };

  const primaries = plan.steps.filter((step) => step.role === "primary");
  const fallbacks = plan.steps.filter((step) => step.role === "fallback");
  const alwaysSurface = plan.steps.filter(
    (step) => step.role === "always_surface",
  );

  await collect(primaries, ctx, state);

  if (!hasUsableQuotes(state.quotes) && fallbacks.length > 0) {
    await collect(fallbacks, ctx, state);
  }

  if (alwaysSurface.length > 0) {
    await collect(alwaysSurface, ctx, state);
  }

  return {
    quotes: state.quotes,
    results: state.results,
    had_stub: state.had_stub,
    needs_paste: state.needs_paste,
    messages: state.messages,
  };
}
