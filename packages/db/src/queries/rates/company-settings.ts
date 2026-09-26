import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KnowledgeBaseSetting,
  RateSourceCode,
  RateSourcesSetting,
} from "../../schema";

const RATE_SOURCES_KEY = "rate_sources";
const KNOWLEDGE_BASE_KEY = "knowledge_base";

const DEFAULT_RATE_SOURCES: RateSourcesSetting = {
  default_currency: "USD",
  allow_offline_paste: true,
  gds_undercut_pct: 10,
  gds_compare_mode: "cheaper_of_public_or_negotiated",
  always_surface_negotiated_gds: true,
  offline_availability_check: true,
  sources: {
    gds_public: { enabled: true },
    gds_negotiated: { enabled: true },
    ota_bedbank: { enabled: false },
    wholesale: { enabled: false },
    offline_contracted: { enabled: true },
    offline_manual: { enabled: true },
  },
};

const DEFAULT_KNOWLEDGE_BASE: KnowledgeBaseSetting = {
  scrape_enabled: false,
  fallback_llm_enabled: true,
  guest_review_factcheck_enabled: false,
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function channelEnabled(
  sources: Record<string, unknown>,
  key: RateSourceCode,
  fallback: boolean,
): boolean {
  const channel = asObject(sources[key]);
  return typeof channel.enabled === "boolean" ? channel.enabled : fallback;
}

/** Parse company_settings.rate_sources jsonb into a typed setting. */
export function parseRateSourcesSetting(
  value: unknown,
): RateSourcesSetting {
  const raw = asObject(value);
  const sources = asObject(raw.sources);
  const defaults = DEFAULT_RATE_SOURCES;

  return {
    default_currency:
      typeof raw.default_currency === "string" && raw.default_currency.trim()
        ? raw.default_currency.trim()
        : defaults.default_currency,
    allow_offline_paste:
      typeof raw.allow_offline_paste === "boolean"
        ? raw.allow_offline_paste
        : defaults.allow_offline_paste,
    gds_undercut_pct:
      typeof raw.gds_undercut_pct === "number"
        ? raw.gds_undercut_pct
        : defaults.gds_undercut_pct,
    gds_compare_mode: "cheaper_of_public_or_negotiated",
    always_surface_negotiated_gds:
      typeof raw.always_surface_negotiated_gds === "boolean"
        ? raw.always_surface_negotiated_gds
        : defaults.always_surface_negotiated_gds,
    offline_availability_check:
      typeof raw.offline_availability_check === "boolean"
        ? raw.offline_availability_check
        : defaults.offline_availability_check,
    sources: {
      gds_public: {
        enabled: channelEnabled(sources, "gds_public", true),
      },
      gds_negotiated: {
        enabled: channelEnabled(sources, "gds_negotiated", true),
      },
      ota_bedbank: {
        enabled: channelEnabled(sources, "ota_bedbank", false),
      },
      wholesale: {
        enabled: channelEnabled(sources, "wholesale", false),
      },
      offline_contracted: {
        enabled: channelEnabled(sources, "offline_contracted", true),
      },
      offline_manual: {
        enabled: channelEnabled(sources, "offline_manual", true),
      },
    },
  };
}

function parseKnowledgeBaseSetting(value: unknown): KnowledgeBaseSetting {
  const raw = asObject(value);
  return {
    scrape_enabled:
      typeof raw.scrape_enabled === "boolean"
        ? raw.scrape_enabled
        : DEFAULT_KNOWLEDGE_BASE.scrape_enabled,
    fallback_llm_enabled:
      typeof raw.fallback_llm_enabled === "boolean"
        ? raw.fallback_llm_enabled
        : DEFAULT_KNOWLEDGE_BASE.fallback_llm_enabled,
    guest_review_factcheck_enabled:
      typeof raw.guest_review_factcheck_enabled === "boolean"
        ? raw.guest_review_factcheck_enabled
        : DEFAULT_KNOWLEDGE_BASE.guest_review_factcheck_enabled,
  };
}

/** Load Rate Layer company defaults (10% rule, source enable flags, paste). */
export async function getRateSourcesSetting(): Promise<RateSourcesSetting> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("company_settings")
      .select("value")
      .eq("key", RATE_SOURCES_KEY)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  if (!data) {
    return DEFAULT_RATE_SOURCES;
  }

  return parseRateSourcesSetting(data.value);
}

/** Load Knowledge Base company toggles. */
export async function getKnowledgeBaseSetting(): Promise<KnowledgeBaseSetting> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("company_settings")
      .select("value")
      .eq("key", KNOWLEDGE_BASE_KEY)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  if (!data) {
    return DEFAULT_KNOWLEDGE_BASE;
  }

  return parseKnowledgeBaseSetting(data.value);
}

/** True when company_settings allows this source channel. */
export function isRateSourceEnabled(
  setting: RateSourcesSetting,
  source: RateSourceCode,
): boolean {
  return setting.sources[source]?.enabled === true;
}

export type RateSourcesSettingPatch = Partial<{
  default_currency: string;
  allow_offline_paste: boolean;
  gds_undercut_pct: number;
  always_surface_negotiated_gds: boolean;
  offline_availability_check: boolean;
  sources: Partial<RateSourcesSetting["sources"]>;
}>;

/** Merge a partial patch onto current rate_sources (no DB I/O). */
export function mergeRateSourcesSetting(
  current: RateSourcesSetting,
  patch: RateSourcesSettingPatch,
): RateSourcesSetting {
  return {
    ...current,
    default_currency: patch.default_currency ?? current.default_currency,
    allow_offline_paste:
      patch.allow_offline_paste ?? current.allow_offline_paste,
    gds_undercut_pct: patch.gds_undercut_pct ?? current.gds_undercut_pct,
    always_surface_negotiated_gds:
      patch.always_surface_negotiated_gds ??
      current.always_surface_negotiated_gds,
    offline_availability_check:
      patch.offline_availability_check ?? current.offline_availability_check,
    gds_compare_mode: "cheaper_of_public_or_negotiated",
    sources: {
      gds_public: patch.sources?.gds_public ?? current.sources.gds_public,
      gds_negotiated:
        patch.sources?.gds_negotiated ?? current.sources.gds_negotiated,
      ota_bedbank: patch.sources?.ota_bedbank ?? current.sources.ota_bedbank,
      wholesale: patch.sources?.wholesale ?? current.sources.wholesale,
      offline_contracted:
        patch.sources?.offline_contracted ?? current.sources.offline_contracted,
      offline_manual:
        patch.sources?.offline_manual ?? current.sources.offline_manual,
    },
  };
}

/** Merge a partial patch into rate_sources and persist. */
export async function upsertRateSourcesSetting(
  patch: RateSourcesSettingPatch,
  updatedById?: string | null,
): Promise<RateSourcesSetting> {
  const current = await getRateSourcesSetting();
  const next = mergeRateSourcesSetting(current, patch);

  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("company_settings").upsert(
      {
        key: RATE_SOURCES_KEY,
        value: next,
        updated_by_id: updatedById ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    ),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return next;
}
