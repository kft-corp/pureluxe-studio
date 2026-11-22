import { rateMessages } from "@pureluxe/shared";

import type { RateSourceCode } from "../../../types";
import type { SabreApplicationResult } from "./application-results";
import type { SabreErrorKind } from "./classify-error";
import { asArray, asRecord, asString } from "./json";

type GdsSource = Extract<RateSourceCode, "gds_public" | "gds_negotiated">;

/** True when Sabre ApplicationResults looks like a bad / unknown hotel code. */
export function isBadHotelCodeResult(
  app: SabreApplicationResult | null | undefined,
): boolean {
  if (!app) return false;
  const blob = `${app.code ?? ""} ${app.message ?? ""}`.toLowerCase();
  return (
    /invalid.?hotel|unknown.?hotel|hotel.?code|hotel.?not.?found|no.?hotel.?found|invalid.?property/.test(
      blob,
    ) || /err\.?hotel|hotelcode/i.test(app.code ?? "")
  );
}

/**
 * Map classified Sabre failures → advisor-facing copy (never invent rates).
 * Negotiated empty stays on negotiated-specific copy when kind is generic empty.
 */
export function sabreErrorTeamMessage(
  kind: SabreErrorKind,
  source: GdsSource,
  options?: { badHotelCode?: boolean },
): string {
  if (options?.badHotelCode) {
    return rateMessages.error.sabreBadHotelCode;
  }

  switch (kind) {
    case "timeout":
      return rateMessages.error.sabreTimeout;
    case "auth":
      return rateMessages.error.sabreAuthFailed;
    case "http_5xx":
      return rateMessages.error.sabreUnavailable;
    case "http_4xx":
    case "bad_request":
      return rateMessages.error.sabreBadRequest;
    case "unknown":
    default:
      return source === "gds_negotiated"
        ? rateMessages.error.sabreRequestFailed
        : rateMessages.error.sabreRequestFailed;
  }
}

/** Empty Avail/Details with no throw — pick inventory vs bad-code vs negotiated copy. */
export function sabreEmptyTeamMessage(
  source: GdsSource,
  app: SabreApplicationResult | null | undefined,
): string {
  if (isBadHotelCodeResult(app)) {
    return rateMessages.error.sabreBadHotelCode;
  }
  return source === "gds_negotiated"
    ? rateMessages.error.sabreNoNegotiatedAvailability
    : rateMessages.error.sabreNoAvailability;
}

function collectAppTexts(response: unknown): string[] {
  const root = asRecord(response);
  const rs =
    asRecord(root?.GetHotelAvailRS) ??
    asRecord(root?.GetHotelDetailsRS) ??
    root;
  if (!rs) return [];

  const app = asRecord(rs.ApplicationResults);
  if (!app) return [];

  const texts: string[] = [];
  for (const key of ["Warning", "Error", "Success"] as const) {
    for (const row of asArray(app[key])) {
      const block = asRecord(row);
      if (!block) continue;
      const short =
        asString(block.ShortText) ??
        asString(block.message) ??
        asString(block.Message);
      if (short) texts.push(short);
      for (const systemRow of asArray(block.SystemSpecificResults)) {
        const system = asRecord(systemRow);
        if (!system) continue;
        for (const msgRow of asArray(system.Message)) {
          const msg = asRecord(msgRow);
          const value =
            asString(msg?.value) ??
            asString(msg?.Value) ??
            asString(msg) ??
            (typeof msgRow === "string" ? msgRow : null);
          if (value) texts.push(value);
        }
      }
    }
  }
  return texts;
}

/** Sabre warned / erred that child pricing was not applied. */
export function responseSignalsChildPricingIgnored(
  response: unknown,
): boolean {
  const texts = collectAppTexts(response);
  for (const text of texts) {
    const lower = text.toLowerCase();
    const aboutChild = /child|infant|age/.test(lower);
    const ignored =
      /not support|unsupported|ignor|unable|not appl|adult.?only|cannot|won't|will not/.test(
        lower,
      );
    if (aboutChild && ignored) return true;
  }
  return false;
}

/**
 * Advisor heads-up when children are on the stay.
 * Stronger copy when Sabre explicitly signals child pricing ignored.
 */
export function sabreChildPricingHeadsUp(
  children: number,
  responses: unknown[],
): string | null {
  if (children <= 0) return null;
  if (responses.some((row) => responseSignalsChildPricingIgnored(row))) {
    return rateMessages.warn.sabreChildPricingIgnored;
  }
  return rateMessages.warn.sabreChildPricingLimited;
}
