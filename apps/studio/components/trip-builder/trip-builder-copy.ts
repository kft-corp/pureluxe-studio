import type { TripDetail, TripRateSnapshot } from "@/lib/trip-builder";
import { pageRoutes } from "@/lib/routes";

import { staysAwaitingRoom } from "./stages";
import { formatMoney } from "./trip-builder-helpers";

/** A new trip with no client yet. */
export const TRIP_START_PROMPT =
  "I've created this trip. Tell me who it's for, where and when, in one line, and I'll set it up. You can undo any change.";

export function staySavedText(input: {
  hotel: string;
  city: string;
  checkIn: string;
  checkOut: string;
  party: string;
  status: "linked" | "none" | "several";
  names: string[];
}): string {
  const lead = `Stay saved for **${input.hotel}** in **${input.city}**, ${input.checkIn} to ${input.checkOut}, ${input.party}.`;
  if (input.status === "linked") {
    return `${lead}\n\nAsk for rates (or more hotels to compare) — I'll search at once and show a compare card. Or paste a supplier quote.`;
  }
  if (input.status === "several") {
    const names = input.names.map((name) => `**${name}**`).join(", ");
    return `${lead}\n\nI found more than one hotel: ${names}. Ask for rates with the exact name, or tap a **Rates** button — no need to update the stay first.`;
  }
  return `${lead}\n\nI don't have that hotel on file. Ask for alternatives in the same destination, or paste a supplier quote.`;
}

/** Points the advisor to the trip page once the client quote is ready to send. */
export function sendHandoff(detail: TripDetail): string {
  if (detail.trip.status !== "building") return "";
  return `\n\nWhen you send it to the client, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and mark **Sent to client** under Update status.`;
}

export const AFTER_ACCEPT_STEPS = [
  "**Before you book**",
  "1. Tap **Search rates again** to see today's availability and hotel price for this room.",
  "2. If the hotel price changed, tap **Use today's cost** to update the team cost.",
  "3. Tap **Set client price** if the client price needs to change.",
  "4. Book with the hotel offline, then **Confirm hotel booking** in **Bookings** (confirmation / PNR required).",
  "5. On the **trip page**, record client payment, then mark **Trip ready for travel** when every stay is confirmed.",
  "",
  "**Travel prep (while you book)**",
  "- Check **Travel prep checklist** on the trip summary — or ask **What's missing before booking?**",
  "- Confirm passport and travel documents on each traveller's client profile in Studio.",
  "- Collect flight or ticket details if the client books travel separately (flights are not booked here yet).",
  "- Ask here anytime about visas, entry rules, documents, or what is still missing.",
].join("\n");

export const CHOSEN_ROOM_NEXT =
  "Tap **Set client price** to set or change what the client pays, or **Search rates again** to check today's hotel price for this room.";

/** Shown once every stay has the client's room after accept. */
export const BOOKING_PREP_GUIDE =
  "Rooms are chosen. Next: check today's hotel price, book offline, then **Confirm hotel booking** in Bookings with the PNR. Clear travel prep (passports, visas, documents). Then record payment on the **trip page**. Ask **What's missing before booking?** if you need help.";

/** What the room choice did to prices: the room's quoted client price, team cost, and the trip total. */
export function choiceSummary(
  room: string,
  row: TripRateSnapshot | null,
  next: TripDetail,
): string {
  const sell = row ? formatMoney(row.sell_amount, row.currency) : "";
  const cost = row ? formatMoney(row.cost_internal, row.currency) : "";
  const price = sell
    ? `Client price **${sell}** from the options quote. Team cost **${cost || "not set"}**.`
    : `Team cost **${cost || "not set"}**. This room has no client price on the options quote.`;
  const open = staysAwaitingRoom(next);
  const total = formatMoney(next.trip.sell_total, next.trip.sell_currency);
  const trip =
    open > 0
      ? `${open === 1 ? "1 more stay needs" : `${open} more stays need`} the client's room before the trip price is set.`
      : total
        ? `Every stay has a room. The trip client price is **${total}**.`
        : "Every stay has a room. Set the trip client price, for example **sell 4500 USD**.";
  return `**${room}** is the client's room for this stay. ${price} The other options were removed, and a pending hotel booking is in **Bookings**.\n\n${trip}`;
}

/** One quote line, short enough for a chat bubble. */
export function clipQuoteLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 140).trim()}…` : clean;
}
