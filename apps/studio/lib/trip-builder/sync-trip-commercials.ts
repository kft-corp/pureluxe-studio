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
