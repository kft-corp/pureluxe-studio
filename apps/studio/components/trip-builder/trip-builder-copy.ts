import type { TripDetail, TripRateSnapshot } from "@/lib/trip-builder";
import { pageRoutes } from "@/lib/routes";

import { partyFromTravellers, staysAwaitingRoom } from "./stages";
import { formatMoney } from "./trip-builder-helpers";

export function whoElseText(detail: TripDetail): string {
  const name = detail.client?.display_name?.trim() || "The lead";
  const lines = [
    `**${name}** is the lead.`,
    "Who else is traveling? Each person has to already be a client.",
  ];
  if (detail.family_suggestions.length > 0) {
    lines.push("From their household:");
    for (const person of detail.family_suggestions) {
      const role = person.family_role === "child" ? "child" : person.family_role;
      lines.push(`- **${person.display_name}** (${role})`);
    }
  } else {
    lines.push("No household is linked to them yet.");
  }
  lines.push("Tap a name, type another client, or say **just them** when the list is complete.");
  return lines.join("\n");
}

export function partySentence(detail: TripDetail): string {
  const names = detail.travellers.map((person) => person.display_name).filter(Boolean);
  const party = partyFromTravellers(detail);
  const counts = [
    party.adults === 1 ? "1 adult" : `${party.adults} adults`,
    party.children === 1 ? "1 child" : party.children > 0 ? `${party.children} children` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `${names.join(", ")} · ${counts}`;
}

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
    return `${lead}\n\nAsk me to search rates, or paste a supplier quote. I'll confirm before I search.`;
  }
  if (input.status === "several") {
    const names = input.names.map((name) => `**${name}**`).join(", ");
    return `${lead}\n\nI found more than one hotel: ${names}. Send **Hotel:** with the exact name and tap **Update stay** before I search rates.`;
  }
  return `${lead}\n\nI don't have that hotel on file, so a rate search may not find a price. Send **Hotel:** with the stored name and tap **Update stay**, or paste a supplier quote.`;
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
  "4. Book with the hotel, then set the booking to confirmed in **Bookings**.",
].join("\n");

export const CHOSEN_ROOM_NEXT =
  "Tap **Set client price** to set or change what the client pays, or **Search rates again** to check today's hotel price for this room.";

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
