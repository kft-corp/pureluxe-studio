import {
  findTripById,
  listPricedAccommodationLineItems,
  updateTrip,
} from "@pureluxe/db";

import { clearTripDossier } from "./trip-dossier";
import { syncTripHotelBooking } from "./sync-trip-booking";
import { buildTripDetail } from "./trip-detail";

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Hotel net is the sum of selected stay costs in one currency.
 * Margin is the client price minus that net, and minus tax only when every
 * priced stay stored a tax percent. Mixed currencies stay empty.
 */
export async function syncTripCommercials(tripId: string): Promise<void> {
  const [trip, rows] = await Promise.all([
    findTripById(tripId),
    listPricedAccommodationLineItems(tripId),
  ]);
  if (!trip) return;

  const priced = rows
    .filter((row) => row.selected)
    .map((row) => {
      const cost = asNumber(row.cost_internal);
      if (cost == null) return null;
      const tax = asNumber(row.tax_percentage);
      return {
        cost,
        currency: row.currency?.trim().toUpperCase() ?? "",
        tax,
      };
    })
    .filter((row): row is { cost: number; currency: string; tax: number | null } => row != null);

  let costTotal: number | null = null;
  let margin: number | null = null;

  const currencies = new Set(priced.map((row) => row.currency));
  if (priced.length > 0 && currencies.size === 1) {
    const net = priced.reduce((sum, row) => sum + row.cost, 0);
    costTotal = money(net);
    const sell = asNumber(trip.sell_total);
    const sellCurrency = trip.sell_currency?.trim().toUpperCase() ?? "";
    const netCurrency = priced[0]?.currency ?? "";
    const sameCurrency = !sellCurrency || !netCurrency || sellCurrency === netCurrency;
    if (sell != null && sameCurrency) {
      const taxReady = priced.every((row) => row.tax != null);
      const tax = taxReady
        ? priced.reduce((sum, row) => sum + (row.cost * (row.tax ?? 0)) / 100, 0)
        : 0;
      margin = money(sell - net - tax);
    }
  }

  await updateTrip(tripId, {
    cost_total_internal: costTotal,
    margin_internal: margin,
  });
}

/**
 * The client price is what the options quote offered for the chosen rooms.
 * Written only when every stay has a chosen room with a client price in one currency,
 * so a half-chosen trip never shows a partial total.
 */
export async function syncClientPriceFromChoices(tripId: string): Promise<void> {
  const trip = await findTripById(tripId);
  if (!trip) return;
  const detail = await buildTripDetail(trip);
  if (detail.stays.length === 0) return;

  const chosen = detail.stays.map(
    (stay) =>
      detail.rates.candidates.find((rate) => rate.selected && rate.leg_id === stay.leg_id) ??
      null,
  );
  const priced: { amount: number; currency: string }[] = [];
  for (const row of chosen) {
    const amount = asNumber(row?.sell_amount);
    if (!row || amount == null) return;
    priced.push({ amount, currency: row.currency?.trim().toUpperCase() ?? "" });
  }
  const currencies = new Set(priced.map((row) => row.currency));
  if (currencies.size !== 1) return;

  const total = money(priced.reduce((sum, row) => sum + row.amount, 0));
  const currency = priced[0]?.currency || null;
  const current = asNumber(trip.sell_total);
  const currentCurrency = trip.sell_currency?.trim().toUpperCase() || null;
  if (current === total && currentCurrency === currency) return;
  await updateTrip(tripId, { sell_total: total, sell_currency: currency });
}

/** Recompute trip totals, then refresh hotel bookings when a client is on the trip. */
export async function refreshTripAfterRateChange(
  tripId: string,
  actor: { memberId: string },
): Promise<void> {
  await syncTripCommercials(tripId);
  clearTripDossier(tripId);
  const trip = await findTripById(tripId);
  if (!trip?.primary_client_id) return;
  const detail = await buildTripDetail(trip);
  await syncTripHotelBooking(detail, actor);
}
