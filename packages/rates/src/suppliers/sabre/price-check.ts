import { rateMessages } from "@pureluxe/shared";

import { hotelPriceCheck } from "./api/hotel-price-check";
import { SabreHttpError } from "./client";
import { getConfig, isConfigured } from "./config";
import { classifySabreError, sabreErrorTeamMessage, sabreLog } from "./helpers";
import {
  mapHotelPriceCheckResponse,
  type SabrePriceCheckMapped,
} from "./mappers/hotel-price-check";

export type PriceCheckSabreInput = {
  rateKey: string;
  /** Prefer converted totals in this currency (default USD). */
  currency?: string;
};

export type PriceCheckSabreResult =
  | { status: "ok"; check: SabrePriceCheckMapped }
  | {
      status: "unavailable";
      message: string;
      /** rate_gone → advisor must search rates again. */
      reason: "rate_gone" | "no_result" | "error";
      requiresReshop: boolean;
    }
  | { status: "error"; message: string; reason: "error"; requiresReshop: false };

/**
 * Live Sabre reprice for one shopped RateKey (Phase 1 offline book handoff).
 */
export async function priceCheckSabreRate(
  input: PriceCheckSabreInput,
): Promise<PriceCheckSabreResult> {
  if (!isConfigured()) {
    return {
      status: "error",
      message: rateMessages.error.liveRatesUnavailable,
      reason: "error",
      requiresReshop: false,
    };
  }

  const rateKey = input.rateKey.trim();
  if (!rateKey) {
    return {
      status: "unavailable",
      message: rateMessages.error.sabrePriceCheckNoRateKey,
      reason: "no_result",
      requiresReshop: true,
    };
  }

  const config = getConfig();
  if (!config) {
    return {
      status: "error",
      message: rateMessages.error.liveRatesUnavailable,
      reason: "error",
      requiresReshop: false,
    };
  }

  try {
    sabreLog.warn("price check starting", { rateKeyLen: rateKey.length });
    const response = await hotelPriceCheck({
      rateKey,
      currency: input.currency ?? "USD",
      config,
    });
    const check = mapHotelPriceCheckResponse(response, rateKey);
    if (!check.ok) {
      const rateGone = check.failureReason === "rate_gone" || check.requiresReshop;
      return {
        status: "unavailable",
        message: rateGone
          ? rateMessages.error.sabrePriceCheckRateGone
          : check.message ?? rateMessages.error.sabrePriceCheckFailed,
        reason: rateGone ? "rate_gone" : check.failureReason ?? "error",
        requiresReshop: rateGone || check.requiresReshop,
      };
    }
    return { status: "ok", check };
  } catch (err) {
    if (err instanceof SabreHttpError) {
      const kind = classifySabreError(err);
      sabreLog.warn("price check http error", { status: err.status, kind });
      return {
        status: kind === "timeout" || kind === "auth" ? "error" : "unavailable",
        message: sabreErrorTeamMessage(kind, "gds_public"),
        reason: "error",
        requiresReshop: false,
      };
    }
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : rateMessages.error.sabrePriceCheckFailed;
    sabreLog.warn("price check failed", { message });
    return {
      status: "error",
      message,
      reason: "error",
      requiresReshop: false,
    };
  }
}
