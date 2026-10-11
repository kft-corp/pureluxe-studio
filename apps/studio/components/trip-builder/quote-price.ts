import type { TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";

export type QuoteBreakup = {
  hotelNet: string | null;
  tax: string | null;
  margin: string | null;
  clientPrice: string | null;
  /** Set when at least one stay has no selected net, for example "2 of 3 stays priced". */
  pricedLabel: string | null;
  /** How margin was calculated, or why it cannot be shown. */
  note: string | null;
};

export function stayNightCount(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number | null {
  if (!checkIn || !checkOut) return null;
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
  const nights = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  return nights > 0 ? nights : null;
}

export function nightsLabel(nights: number): string {
  return nights === 1 ? "1 night" : `${nights} nights`;
}

/** Hotel nights we can count. Null when no stay has both dates. */
export function tripNightCount(stays: TripStaySnapshot[]): number | null {
  const counts = stays
    .map((stay) => stayNightCount(stay.check_in, stay.check_out))
    .filter((nights): nights is number => nights != null);
  if (counts.length === 0) return null;
  return counts.reduce((sum, nights) => sum + nights, 0);
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function currencyCode(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function percentLabel(value: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

type PricedStay = {
  cost: number;
  currency: string;
  taxPercentage: number | null;
};

function selectedPricedStay(
  stay: TripStaySnapshot,
  rates: TripRateSnapshot[],
): PricedStay | null {
  const rate = rates.find((row) => row.selected && row.leg_id === stay.leg_id);
  const cost = rate?.cost_internal == null ? null : Number(rate.cost_internal);
  if (!rate || cost == null || !Number.isFinite(cost)) return null;
  const tax =
    rate.tax_percentage == null ? null : Number(rate.tax_percentage);
  return {
    cost,
    currency: currencyCode(rate.currency),
    taxPercentage: tax != null && Number.isFinite(tax) ? tax : null,
  };
}

/**
 * Advisor-facing quote math.
 * Hotel net is the sum of selected stay costs. Tax uses each stay's stored
 * percentage. Margin is the client price minus those amounts. Missing numbers
 * stay empty so the panel can show "Not set".
 */
export function buildQuoteBreakup(input: {
  stays: TripStaySnapshot[];
  rates: TripRateSnapshot[];
  sellTotal: number | null;
  sellCurrency: string | null;
}): QuoteBreakup {
  const priced = input.stays
    .map((stay) => selectedPricedStay(stay, input.rates))
    .filter((row): row is PricedStay => row != null);
  const pricedLabel =
    input.stays.length > 0 && priced.length < input.stays.length
      ? `${priced.length} of ${input.stays.length} stays priced`
      : null;

  const sellCurrency = currencyCode(input.sellCurrency);
  const clientPrice =
    input.sellTotal == null ? null : money(input.sellTotal, sellCurrency);

  if (priced.length === 0) {
    return {
      hotelNet: null,
      tax: null,
      margin: null,
      clientPrice,
      pricedLabel,
      note: null,
    };
  }

  const currencies = new Set(priced.map((row) => row.currency));
  if (currencies.size > 1) {
    return {
      hotelNet: null,
      tax: null,
      margin: null,
      clientPrice,
      pricedLabel,
      note: "Selected stays use more than one currency, so the totals are not added.",
    };
  }

  const netCurrency = priced[0]?.currency ?? "";
  const hotelNetAmount = priced.reduce((sum, row) => sum + row.cost, 0);
  const hotelNet = money(hotelNetAmount, netCurrency);

  const taxReady = priced.every((row) => row.taxPercentage != null);
  const taxAmount = taxReady
    ? priced.reduce((sum, row) => sum + (row.cost * (row.taxPercentage ?? 0)) / 100, 0)
    : null;
  const taxPercents = taxReady
    ? [...new Set(priced.map((row) => row.taxPercentage ?? 0))]
    : [];
  const tax =
    taxAmount == null
      ? null
      : taxPercents.length === 1
        ? `${money(taxAmount, netCurrency)} (${percentLabel(taxPercents[0] ?? 0)})`
        : money(taxAmount, netCurrency);

  if (input.sellTotal == null) {
    return {
      hotelNet,
      tax,
      margin: null,
      clientPrice,
      pricedLabel,
      note: null,
    };
  }

  if (sellCurrency && netCurrency && sellCurrency !== netCurrency) {
    return {
      hotelNet,
      tax,
      margin: null,
      clientPrice,
      pricedLabel,
      note: "Client price and hotel net use different currencies, so margin is not calculated.",
    };
  }

  const marginAmount = input.sellTotal - hotelNetAmount - (taxAmount ?? 0);
  const marginCurrency = sellCurrency || netCurrency;
  return {
    hotelNet,
    tax,
    margin: money(marginAmount, marginCurrency),
    clientPrice,
    pricedLabel,
    note: taxReady
      ? "Margin is the client price minus the hotel net and tax."
      : "Margin is the client price minus the hotel net. Tax is not set.",
  };
}
