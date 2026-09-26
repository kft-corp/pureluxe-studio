import {
  findActiveContractedRateForStay,
  findActiveRoutingOverride,
  listActiveDestinationTypeDefaults,
  listActivePeakWindowsForStay,
  type DestinationProfile,
  type DestinationType,
  type PropertyContractedRate,
  type RatePeakWindow,
} from "@pureluxe/db";

import type { RoutingLayer, RoutingPattern } from "../types";

/** Company fallback when no profile / type / override applies. */
export const LAYER4_DEFAULT_PATTERN: RoutingPattern = "gds_first";

export type ResolveRoutingInput = {
  property_id?: string | null;
  check_in: string;
  check_out: string;
  profile: DestinationProfile | null;
};

export type ResolvedRouting = {
  layer: RoutingLayer;
  pattern: RoutingPattern;
  destination_type: DestinationType | null;
  destination_profile_id: string | null;
  contracted_rate: PropertyContractedRate | null;
  peak_windows: RatePeakWindow[];
  /** From Layer 2 override when pattern is custom. */
  custom_source_order: string[] | null;
};

/**
 * Waterfall: L1 contracted → L2 override → L3 type default → L4 company.
 * First match wins.
 */
export async function resolveRoutingLayer(
  input: ResolveRoutingInput,
): Promise<ResolvedRouting> {
  const destination_type = input.profile?.destination_type ?? null;
  const destination_profile_id = input.profile?.id ?? null;

  const peak_windows = await listActivePeakWindowsForStay({
    check_in: input.check_in,
    check_out: input.check_out,
    destination_profile_id,
    destination_type,
  });

  // Layer 1 — property has an active contracted rate covering the stay.
  if (input.property_id) {
    const contracted_rate = await findActiveContractedRateForStay({
      property_id: input.property_id,
      check_in: input.check_in,
      check_out: input.check_out,
    });

    if (contracted_rate) {
      return {
        layer: 1,
        pattern: "offline_only",
        destination_type,
        destination_profile_id,
        contracted_rate,
        peak_windows,
        custom_source_order: null,
      };
    }
  }

  // Layer 2 — destination-specific override.
  if (input.profile) {
    const override = await findActiveRoutingOverride(input.profile.id);
    if (override) {
      return {
        layer: 2,
        pattern: override.pattern,
        destination_type,
        destination_profile_id,
        contracted_rate: null,
        peak_windows,
        custom_source_order: override.custom_source_order,
      };
    }
  }

  // Layer 3 — type default (skip untyped/custom → Layer 4).
  if (destination_type && destination_type !== "untyped") {
    const defaults = await listActiveDestinationTypeDefaults();
    const typeDefault = defaults.find(
      (row) => row.destination_type === destination_type,
    );

    if (typeDefault && typeDefault.pattern !== "custom") {
      return {
        layer: 3,
        pattern: typeDefault.pattern,
        destination_type,
        destination_profile_id,
        contracted_rate: null,
        peak_windows,
        custom_source_order: null,
      };
    }
  }

  // Layer 4 — company default.
  return {
    layer: 4,
    pattern: LAYER4_DEFAULT_PATTERN,
    destination_type,
    destination_profile_id,
    contracted_rate: null,
    peak_windows,
    custom_source_order: null,
  };
}
