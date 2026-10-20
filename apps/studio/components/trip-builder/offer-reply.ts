import { isConfirmReply, isDeclineReply } from "@/lib/trip-builder/intents";

import type { Offer } from "./trip-builder-helpers";

/** Label for the chip that says "no" to the open question. */
export const DECLINE_LABELS: Record<Offer["type"], string> = {
  "rate-search": "Don't search",
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
