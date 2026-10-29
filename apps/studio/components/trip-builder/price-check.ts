import type { NormalizedRateOption } from "@pureluxe/rates";

import type { TripDetail, TripRateSnapshot } from "@/lib/trip-builder";

import { formatMoney, type CostUpdate } from "./trip-builder-helpers";

const AVAILABILITY_LABELS: Record<NormalizedRateOption["availability_status"], string> = {
  available: "Available",
  on_request: "On request",
  unknown: "Availability not confirmed",
  unavailable: "Not available",
};

function roomKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Today's result for the chosen room: same room name, either way round. */
function matchChosenRoom(
  chosen: TripRateSnapshot,
  options: NormalizedRateOption[],
): NormalizedRateOption | null {
  const want = roomKey(chosen.subtitle) || roomKey(chosen.title);
  if (!want) return null;
  return (
    options.find((option) => roomKey(option.room_name) === want) ??
    options.find((option) => {
      const name = roomKey(option.room_name);
      return Boolean(name) && (name.includes(want) || want.includes(name));
    }) ??
    null
  );
}

/**
 * After acceptance a rate search is a price check on the chosen room.
 * Returns the note and, when today's team cost differs, the cost to offer.
 */
export function priceCheck(
  detail: TripDetail,
  legId: string,
  options: NormalizedRateOption[],
): { note: string; update: CostUpdate | null } {
  const chosen = detail.rates.candidates.find(
    (rate) => rate.selected && rate.leg_id === legId,
  );
  if (!chosen) {
    return {
      note: "No room is chosen for this stay yet. Tap **Client chose this** on the room the client picked, then check again.",
      update: null,
    };
  }
  const room = chosen.subtitle?.trim() || chosen.title;
  const onFile = formatMoney(chosen.cost_internal, chosen.currency) || "not set";
  const sell = formatMoney(chosen.sell_amount, chosen.currency);
  const header = `**Price check · ${room}**\n\nCost on file **${onFile}**${sell ? `. Sell **${sell}**` : ""}.`;
  const today = matchChosenRoom(chosen, options);
  if (!today) {
    return {
      note: `${header}\n\nThis room is not in today's results, so check availability with the hotel before you book. You can still set the sell price.`,
      update: null,
    };
  }
  const availability = AVAILABILITY_LABELS[today.availability_status];
  const todayCost = formatMoney(today.cost_internal, today.currency);
  const sameCurrency =
    !chosen.currency ||
    chosen.currency.trim().toUpperCase() === today.currency.trim().toUpperCase();
  const changed = sameCurrency && today.cost_internal !== chosen.cost_internal;
  const lines = [header, `Today: **${availability}**, cost **${todayCost}**.`];
  if (!sameCurrency) {
    lines.push("Today's price is in a different currency, so compare it with the hotel before you book.");
  } else if (!changed) {
    lines.push("The cost has not changed. Book with the hotel, then confirm the booking in **Bookings**.");
  } else {
    lines.push(
      `The cost has changed. Tap **Use today's cost** to update the room and the pending booking, then set the sell if it needs to change.`,
    );
  }
  return {
    note: lines.join("\n\n"),
    update: changed
      ? { lineItemId: chosen.id, room, amount: today.cost_internal, currency: today.currency }
      : null,
  };
}
