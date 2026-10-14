/** Statuses where the client has already accepted the quote. The accepted PDF stays as sent. */
const ACCEPTED = new Set(["booking", "confirmed", "completed"]);

/** Statuses where the quote is with the client. A change makes the sent PDF out of date. */
const WITH_CLIENT = new Set(["quote_sent", "waiting_on_client"]);

export function isQuoteAccepted(status: string): boolean {
  return ACCEPTED.has(status);
}

export function isQuoteWithClient(status: string): boolean {
  return WITH_CLIENT.has(status);
}

export function isTripClosed(status: string): boolean {
  return status === "cancelled";
}
