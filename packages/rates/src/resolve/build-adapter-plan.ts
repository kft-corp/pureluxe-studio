import {
  isRateSourceEnabled,
  type DestinationWholesaler,
  type RateSourcesSetting,
} from "@pureluxe/db";

import { RATE_SOURCE_CODES, type RateSourceCode, type RoutingPattern } from "../types";
import type { ResolvedRouting } from "./resolve-routing-layer";

export type AdapterStepRole =
  | "primary"
  | "fallback"
  | "always_surface";

/** One source channel the orchestrator should call (or paste for). */
export type AdapterStep = {
  source: RateSourceCode;
  role: AdapterStepRole;
};

export type AdapterPlan = {
  layer: ResolvedRouting["layer"];
  pattern: RoutingPattern;
  steps: AdapterStep[];
  /**
   * True when the plan itself requires paste up front (offline_only).
   * Peak offline is a fallback — paste only after GDS returns empty.
   */
  requires_offline_paste: boolean;
  in_peak_window: boolean;
};

const SOURCE_SET = new Set<string>(RATE_SOURCE_CODES);

function asRateSource(code: string): RateSourceCode | null {
  return SOURCE_SET.has(code) ? (code as RateSourceCode) : null;
}

function pushIfEnabled(
  steps: AdapterStep[],
  setting: RateSourcesSetting,
  source: RateSourceCode,
  role: AdapterStepRole,
): void {
  if (!isRateSourceEnabled(setting, source)) return;
  if (steps.some((step) => step.source === source)) return;
  steps.push({ source, role });
}

function addGdsPair(
  steps: AdapterStep[],
  setting: RateSourcesSetting,
  role: AdapterStepRole,
): void {
  pushIfEnabled(steps, setting, "gds_public", role);
  pushIfEnabled(steps, setting, "gds_negotiated", role);
}

/**
 * Turn layer + pattern + enable flags into an ordered adapter list.
 * Does not call suppliers — only decides what to call.
 */
export function buildAdapterPlan(input: {
  routing: ResolvedRouting;
  setting: RateSourcesSetting;
  wholesalers?: DestinationWholesaler[];
}): AdapterPlan {
  const { routing, setting } = input;
  const in_peak_window = routing.peak_windows.length > 0;
  const steps: AdapterStep[] = [];
  let requires_offline_paste = false;

  // L1 — only offline contracted (one or many room/package rows).
  if (routing.layer === 1 && routing.contracted_rates.length > 0) {
    pushIfEnabled(steps, setting, "offline_contracted", "primary");
    return {
      layer: routing.layer,
      pattern: routing.pattern,
      steps,
      requires_offline_paste: false,
      in_peak_window,
    };
  }

  // Layer 2 custom order wins when present.
  if (
    routing.pattern === "custom" &&
    routing.custom_source_order &&
    routing.custom_source_order.length > 0
  ) {
    for (const raw of routing.custom_source_order) {
      const source = asRateSource(raw);
      if (source) pushIfEnabled(steps, setting, source, "primary");
    }
  } else {
    switch (routing.pattern) {
      case "offline_only":
        requires_offline_paste = setting.allow_offline_paste;
        pushIfEnabled(steps, setting, "offline_manual", "primary");
        pushIfEnabled(steps, setting, "offline_contracted", "fallback");
        break;

      case "gds_first":
        addGdsPair(steps, setting, "primary");
        pushIfEnabled(steps, setting, "ota_bedbank", "fallback");
        break;

      case "wholesale_first":
        if ((input.wholesalers?.length ?? 0) > 0) {
          pushIfEnabled(steps, setting, "wholesale", "primary");
        }
        addGdsPair(steps, setting, "fallback");
        pushIfEnabled(steps, setting, "ota_bedbank", "fallback");
        break;

      case "parallel_lowest":
        pushIfEnabled(steps, setting, "wholesale", "primary");
        addGdsPair(steps, setting, "primary");
        pushIfEnabled(steps, setting, "ota_bedbank", "primary");
        break;

      case "gds_then_offline_at_peak":
        addGdsPair(steps, setting, "primary");
        pushIfEnabled(steps, setting, "ota_bedbank", "fallback");
        // Offline only as fallback when peak — run after GDS empty.
        if (in_peak_window && setting.allow_offline_paste) {
          pushIfEnabled(steps, setting, "offline_manual", "fallback");
        }
        break;

      case "custom":
      default:
        addGdsPair(steps, setting, "primary");
        break;
    }
  }

  // Always keep negotiated in the plan when company asks to surface it.
  if (setting.always_surface_negotiated_gds) {
    pushIfEnabled(steps, setting, "gds_negotiated", "always_surface");
  }

  return {
    layer: routing.layer,
    pattern: routing.pattern,
    steps,
    requires_offline_paste,
    in_peak_window,
  };
}
