import { asArray, asNumber, asRecord, asString } from "../helpers";

/** Why a Price Check failed or needs a new shop. */
export type SabrePriceCheckFailureReason =
  | "rate_gone"
  | "no_result"
  | "error";

/** Normalized Sabre Price Check outcome for Trip Builder. */
export type SabrePriceCheckMapped = {
  ok: boolean;
  priceChanged: boolean;
  priceDifference: number | null;
  currency: string | null;
  /** Stay total after tax when Sabre returns one. */
  costInternal: number | null;
  bookingKey: string | null;
  rateKey: string | null;
  message: string | null;
  /** Set when ok is false — rate gone vs generic error. */
  failureReason: SabrePriceCheckFailureReason | null;
  /** True when Sabre says the product must be re-shopped. */
  requiresReshop: boolean;
  raw: Record<string, unknown>;
};

/** Studio shops Sabre in USD — prefer converted totals when Sabre returns both. */
const PREFERRED_CURRENCY = "USD";

function firstConvertedRateInfo(
  hotelRateInfo: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!hotelRateInfo) return null;
  const rateInfos = asRecord(hotelRateInfo.RateInfos ?? hotelRateInfo.rateInfos);
  if (!rateInfos) return null;
  const list = asArray(
    rateInfos.ConvertedRateInfo ?? rateInfos.convertedRateInfo,
  );
  return asRecord(list[0]);
}

function firstLocalRateInfo(
  hotelRateInfo: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!hotelRateInfo) return null;
  const rateInfos = asRecord(hotelRateInfo.RateInfos ?? hotelRateInfo.rateInfos);
  const list = asArray(rateInfos?.RateInfo ?? rateInfos?.rateInfo);
  return asRecord(list[0]);
}

function deepAmount(record: Record<string, unknown> | null): number | null {
  if (!record) return null;
  const direct =
    asNumber(record.AmountAfterTax) ??
    asNumber(record.amountAfterTax) ??
    asNumber(record.ApproxTotalPrice) ??
    asNumber(record.approxTotalPrice) ??
    asNumber(record.ConvertedAmountAfterTax) ??
    asNumber(record.convertedAmountAfterTax) ??
    asNumber(record.TotalPrice) ??
    asNumber(record.totalPrice) ??
    asNumber(record.AmountBeforeTax) ??
    asNumber(record.amountBeforeTax);
  if (direct != null) return direct;

  // Nested ConvertedRateInfo / Total shapes.
  for (const key of [
    "ConvertedRateInfo",
    "convertedRateInfo",
    "Total",
    "total",
    "RateTotalAmount",
    "rateTotalAmount",
  ]) {
    const nested = asRecord(record[key]);
    if (!nested) continue;
    const amount =
      asNumber(nested.AmountAfterTax) ??
      asNumber(nested.amountAfterTax) ??
      asNumber(nested.ApproxTotalPrice) ??
      asNumber(nested.approxTotalPrice) ??
      asNumber(nested.Amount) ??
      asNumber(nested.amount) ??
      asNumber(nested.value);
    if (amount != null) return amount;
  }
  return null;
}

/**
 * Prefer Sabre converted USD (ConvertedRateInfo / ConvertedCurrencyCode).
 * Fall back to local RateInfo only when converted totals are missing.
 */
function readPreferredAmountAndCurrency(
  info: Record<string, unknown> | null,
  hotelRateInfo: Record<string, unknown> | null,
): { amount: number | null; currency: string | null } {
  const converted = firstConvertedRateInfo(hotelRateInfo);
  const convertedAmount = deepAmount(converted);
  const convertedCurrency =
    asString(converted?.CurrencyCode) ??
    asString(converted?.currencyCode) ??
    asString(info?.ConvertedCurrencyCode) ??
    asString(info?.convertedCurrencyCode);

  if (convertedAmount != null) {
    return {
      amount: convertedAmount,
      currency: (convertedCurrency ?? PREFERRED_CURRENCY).toUpperCase(),
    };
  }

  // Nested ConvertedRateInfo on the local RateInfo row (some Sabre shapes).
  const local = firstLocalRateInfo(hotelRateInfo);
  const nestedConverted = asRecord(
    local?.ConvertedRateInfo ?? local?.convertedRateInfo,
  );
  const nestedAmount = deepAmount(nestedConverted);
  if (nestedAmount != null) {
    const nestedCurrency =
      asString(nestedConverted?.CurrencyCode) ??
      asString(nestedConverted?.currencyCode) ??
      asString(info?.ConvertedCurrencyCode) ??
      PREFERRED_CURRENCY;
    return { amount: nestedAmount, currency: nestedCurrency.toUpperCase() };
  }

  const localAmount = deepAmount(local) ?? deepAmount(info);
  const localCurrency =
    asString(info?.ConvertedCurrencyCode) ??
    asString(info?.convertedCurrencyCode) ??
    asString(local?.CurrencyCode) ??
    asString(local?.currencyCode) ??
    asString(info?.CurrencyCode) ??
    asString(info?.currencyCode);

  return {
    amount: localAmount,
    currency: localCurrency ? localCurrency.toUpperCase() : null,
  };
}

function collectErrorText(errors: unknown[]): string {
  const parts: string[] = [];
  for (const row of errors) {
    const first = asRecord(row);
    if (!first) continue;
    const system = asRecord(
      asArray(first.SystemSpecificResults ?? first.systemSpecificResults)[0],
    );
    const msg =
      asString(asRecord(asArray(system?.Message ?? system?.message)[0])?.value) ??
      asString(first.shortText) ??
      asString(first.ShortText) ??
      asString(first.message) ??
      asString(first.Message);
    if (msg) parts.push(msg);
    const code = asString(first.code) ?? asString(first.Code);
    if (code) parts.push(code);
  }
  return parts.join(" ").trim();
}

/** Sabre wording that means the shopped product is gone / must re-shop. */
export function isSabreReshopSignal(text: string): boolean {
  const blob = text.toLowerCase();
  return (
    /re-?shop|reshop|shop again|new shop|rate.?key.*(invalid|expired|not.?found)|product.*(not.?available|unavailable|no longer)|no longer available|rate.*(not.?available|unavailable|expired)|unable to match|cannot match|not the same|inventory.*not|sold out/.test(
      blob,
    )
  );
}

/**
 * Map HotelPriceCheckRS (Pascal or camel) into a stable Studio shape.
 */
export function mapHotelPriceCheckResponse(
  response: unknown,
  rateKey: string,
): SabrePriceCheckMapped {
  const root = asRecord(response) ?? {};
  const rs =
    asRecord(root.HotelPriceCheckRS) ??
    asRecord(root.hotelPriceCheckRs) ??
    root;

  const appResults =
    asRecord(rs.ApplicationResults) ?? asRecord(rs.applicationResults);
  const errors = asArray(appResults?.Error ?? appResults?.error);
  const warnings = asArray(appResults?.Warning ?? appResults?.warning);
  if (errors.length > 0) {
    const msg = collectErrorText(errors) || "Live GDS price check failed.";
    const requiresReshop = isSabreReshopSignal(msg);
    return {
      ok: false,
      priceChanged: false,
      priceDifference: null,
      currency: null,
      costInternal: null,
      bookingKey: null,
      rateKey,
      message: msg,
      failureReason: requiresReshop ? "rate_gone" : "error",
      requiresReshop,
      raw: root,
    };
  }

  const info =
    asRecord(rs.PriceCheckInfo) ?? asRecord(rs.priceCheckInfo) ?? null;
  if (!info) {
    const warnText = collectErrorText(warnings);
    const requiresReshop = isSabreReshopSignal(warnText);
    return {
      ok: false,
      priceChanged: false,
      priceDifference: null,
      currency: null,
      costInternal: null,
      bookingKey: null,
      rateKey,
      message:
        warnText ||
        (requiresReshop
          ? "This GDS rate is no longer available."
          : "Live GDS did not return a price check result."),
      failureReason: requiresReshop ? "rate_gone" : "no_result",
      requiresReshop,
      raw: root,
    };
  }

  const hotelRateInfo =
    asRecord(info.HotelRateInfo) ?? asRecord(info.hotelRateInfo);
  const preferred = readPreferredAmountAndCurrency(info, hotelRateInfo);
  const costInternal = preferred.amount;
  const currency = preferred.currency;
  // Prefer converted price-change flags when we are quoting in USD.
  const priceChanged =
    info.ConvertedPriceChange === true ||
    info.convertedPriceChange === true ||
    info.PriceChange === true ||
    info.priceChange === true;
  const priceDifference =
    asNumber(info.ConvertedPriceDifference) ??
    asNumber(info.convertedPriceDifference) ??
    asNumber(info.PriceDifference) ??
    asNumber(info.priceDifference);

  const warnText = collectErrorText(warnings);
  const requiresReshop = isSabreReshopSignal(warnText);

  // Successful match but Sabre warned to re-shop — treat as rate gone.
  if (requiresReshop && !asString(info.BookingKey) && !asString(info.bookingKey)) {
    return {
      ok: false,
      priceChanged,
      priceDifference,
      currency,
      costInternal,
      bookingKey: null,
      rateKey,
      message: warnText || "This GDS rate is no longer available.",
      failureReason: "rate_gone",
      requiresReshop: true,
      raw: root,
    };
  }

  return {
    ok: true,
    priceChanged,
    priceDifference,
    currency,
    costInternal,
    bookingKey:
      asString(info.BookingKey) ?? asString(info.bookingKey),
    rateKey,
    message: null,
    failureReason: null,
    requiresReshop: false,
    raw: root,
  };
}
