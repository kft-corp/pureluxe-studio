import {
  getRateSourcesSetting,
  listActiveDestinationProfiles,
  listActiveDestinationTypeDefaults,
  listActiveNegotiatedRateCodes,
  upsertRateSourcesSetting,
  type DestinationProfile,
  type DestinationTypeDefault,
  type NegotiatedRateCode,
  type RateSourcesSetting,
} from "@pureluxe/db";
import type { UpdateRateSourcesSettingBody } from "@pureluxe/shared";

/** Company toggles only (GET/PATCH /api/settings/rate-sources). */
export type RateSourcesData = {
  rate_sources: RateSourcesSetting;
};

export type DestinationsSettingsData = {
  destination_profiles: DestinationProfile[];
  /** Tiny catalog — kept with destinations for routing Settings UI. */
  destination_type_defaults: DestinationTypeDefault[];
};

export type NegotiatedCodesSettingsData = {
  negotiated_rate_codes: NegotiatedRateCode[];
};

/** GET company rate_sources jsonb only. */
export async function getRateSources(): Promise<RateSourcesData> {
  const rate_sources = await getRateSourcesSetting();
  return { rate_sources };
}

/** PATCH company rate_sources. */
export async function patchRateSourcesSetting(
  patch: UpdateRateSourcesSettingBody,
  actor: { memberId: string },
): Promise<RateSourcesSetting> {
  return upsertRateSourcesSetting(patch, actor.memberId);
}

/** GET destination profiles + type defaults. */
export async function getDestinationsSettings(): Promise<DestinationsSettingsData> {
  const [destination_profiles, destination_type_defaults] = await Promise.all([
    listActiveDestinationProfiles(),
    listActiveDestinationTypeDefaults(),
  ]);

  return { destination_profiles, destination_type_defaults };
}

/** GET negotiated / consortia GDS codes. */
export async function getNegotiatedCodesSettings(): Promise<NegotiatedCodesSettingsData> {
  const negotiated_rate_codes = await listActiveNegotiatedRateCodes();
  return { negotiated_rate_codes };
}
