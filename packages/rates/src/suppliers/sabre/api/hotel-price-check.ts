import { requestJson, SabreHttpError } from "../client";
import { getConfig, type SabreConfig } from "../config";

/** Default shop / reprice currency for Trip Builder (matches Avail ConvertedRateInfoOnly). */
const DEFAULT_CURRENCY = "USD";

export type HotelPriceCheckInput = {
  rateKey: string;
  /** ISO currency for converted totals. Defaults to USD. */
  currency?: string;
  config?: SabreConfig;
};

function pascalBody(rateKey: string, pcc: string, currency: string) {
  return {
    HotelPriceCheckRQ: {
      version: "5.0.0",
      POS: { Source: { PseudoCityCode: pcc } },
      RateInfoRef: {
        RateKey: rateKey,
        CurrencyCode: currency,
      },
    },
  };
}

/** Alternate camelCase shape some Sabre REST samples use. */
function camelBody(rateKey: string, currency: string) {
  return {
    hotelPriceCheckRq: {
      rateInfoRef: {
        rateKey,
        currencyCode: currency,
      },
    },
  };
}

/**
 * Validate a shopped Sabre rate with its RateKey.
 * Sabre: POST /v5/hotel/pricecheck
 * Tries PascalCase (Avail/Details style) first; on HTTP 400 retries camelCase.
 */
export async function hotelPriceCheck(
  input: HotelPriceCheckInput,
): Promise<unknown> {
  const config = input.config ?? getConfig();
  if (!config) {
    throw new Error("Sabre is not configured");
  }

  const rateKey = input.rateKey.trim();
  if (!rateKey) {
    throw new Error("A Sabre rate key is required");
  }
  const currency = (input.currency ?? DEFAULT_CURRENCY).trim().toUpperCase() || DEFAULT_CURRENCY;

  try {
    return await requestJson({
      path: "/v5/hotel/pricecheck",
      body: pascalBody(rateKey, config.pcc, currency),
      config,
    });
  } catch (err) {
    if (err instanceof SabreHttpError && err.status === 400) {
      // Some Sabre stacks reject CurrencyCode on PriceCheck — retry without it,
      // then map ConvertedRateInfo (USD) on the response.
      try {
        return await requestJson({
          path: "/v5/hotel/pricecheck",
          body: {
            HotelPriceCheckRQ: {
              version: "5.0.0",
              POS: { Source: { PseudoCityCode: config.pcc } },
              RateInfoRef: { RateKey: rateKey },
            },
          },
          config,
        });
      } catch (inner) {
        if (inner instanceof SabreHttpError && inner.status === 400) {
          return requestJson({
            path: "/v5/hotel/pricecheck",
            body: camelBody(rateKey, currency),
            config,
          });
        }
        throw inner;
      }
    }
    throw err;
  }
}
