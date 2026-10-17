import { isConfirmReply, isDeclineReply } from "@/lib/trip-builder/intents";

import type { Offer } from "./trip-builder-helpers";

/** Label for the chip that says "no" to the open question. */
export const DECLINE_LABELS: Record<Offer["type"], string> = {
  "trip-dates": "Keep current dates",
  "shift-trip": "Keep current dates",
  "date-drop": "Keep current dates",
  "remove-stay": "Keep this stay",
  "revise-stay": "Keep stay as is",
  "add-stay": "Don't add",
  "stay-overlap": "Don't save",
  "stay-update": "Keep stay as is",
  lead: "Keep current lead",
  traveller: "Don't add",
  role: "Keep as is",
  "rate-search": "Don't search",
  assign: "Don't add",
  paste: "Don't use",
  sell: "Keep current price",
  "add-option": "Don't save",
  "select-room": "Not yet",
  "options-text": "Keep wording",
  "options-preview": "Not now",
  "options-edit": "Keep as is",
};

/** The reply when the advisor answers no to the open question. */
export const DECLINE_REPLIES: Record<Offer["type"], string> = {
  "trip-dates": "Okay. The trip dates stay as they are.",
  "shift-trip": "Okay. The trip dates stay as they are.",
  "date-drop": "Okay. The trip dates stay as they are.",
  "remove-stay": "Okay. I won't remove that stay.",
  "revise-stay": "Okay. That stay stays as it is.",
  "add-stay": "Okay. I won't add that stay.",
  "stay-overlap": "Okay. I won't save those overlapping nights.",
  "stay-update": "Okay. That stay stays as it is.",
  lead: "Okay. The lead stays as it is.",
  traveller: "Okay. Name someone else, or say **just them**.",
  role: "Okay. That traveller stays as they are.",
  assign: "Okay. I won't add that client.",
  "rate-search": "Okay. I won't search. Ask again when you want prices, or paste a supplier quote.",
  paste: "Okay. I won't use that quote.",
  sell: "Okay. I won't change the client price.",
  "add-option": "Okay. I won't save that room.",
  "select-room": "Okay. That room stays unselected.",
  "options-text": "Okay. I won't change that wording.",
  "options-edit": "Okay. The options quote stays as it is.",
  "options-preview": "Okay. I won't open the options quote.",
};

export type OfferReply = { kind: "decline"; reply: string } | { kind: "confirm" };

/** A short yes or no to the open question. Null when there is no question or the message is anything else. */
export function readReply(offer: Offer | null, message: string): OfferReply | null {
  if (!offer) return null;
  if (isDeclineReply(message)) return { kind: "decline", reply: DECLINE_REPLIES[offer.type] };
  if (isConfirmReply(message)) return { kind: "confirm" };
  return null;
}
