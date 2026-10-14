import type { RateSourceCode } from "@pureluxe/db";

export type { RateSourceCode } from "@pureluxe/db";

/** Canonical source codes the resolver may return on an option. */
export const RATE_SOURCE_CODES = [
  "gds_public",
  "gds_negotiated",
  "ota_bedbank",
  "wholesale",
  "offline_contracted",
  "offline_manual",
] as const satisfies readonly RateSourceCode[];
