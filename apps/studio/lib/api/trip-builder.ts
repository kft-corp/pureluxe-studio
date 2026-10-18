import type { TripLineItem } from "@pureluxe/db";
import type { SearchRatesResult } from "@pureluxe/rates";

export type TripBuilderRateSearch = SearchRatesResult & {
  hotel_brief: string | null;
  stay_notes: {
    checkIn: string | null;
    checkOut: string | null;
    payment: string[];
    offers: string[];
    required: string[];
    markup: string | null;
  } | null;
  rate_context: string | null;
};
import {
  isApiErrorResponse,
  type AddRateOptionBody,
  type ApiErrorResponse,
  type CreateTripBody,
  type GenerateTripQuoteBody,
  type ListTripsQuery,
  type PasteLineItemBody,
  type SearchRatesBody,
  type AddTripLegBody,
  type SetTripStayBody,
  type ShiftTripDatesBody,
  type UpdateTripLegBody,
  type TripBuilderChatSendBody,
  type TripBuilderPreTripChatSendBody,
  type UpdateTripBody,
  type UpdateTripQuoteBody,
  type UpdateOptionsQuoteBody,
  type UpdateStayOptionBody,
} from "@pureluxe/shared";

import type {
  ChatMessage,
  ChatMessagePage,
  ChatStreamEvent,
  TripDetail,
  StayPropertyMatch,
  TripListResult,
  TripQuoteSnapshot,
} from "@/lib/trip-builder";
import { apiRoutes } from "@/lib/routes";

import { ApiRequestError, fetchApi } from "./client";

type TripQuoteResponse = {
  detail: TripDetail;
  quote: TripQuoteSnapshot;
};

function toQueryString(params: Partial<ListTripsQuery>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "any") {
    search.set("status", params.status);
  }
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Load assigned trips for Trip Builder home / switcher. */
export function listTripBuilderTrips(params: Partial<ListTripsQuery> = {}) {
  return fetchApi<TripListResult>(
    `${apiRoutes.tripBuilder.trips}${toQueryString(params)}`,
    { cache: "no-store" },
  );
}

/** Load one assigned trip aggregate. */
export function getTripBuilderTrip(tripId: string) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trip(tripId), {
    cache: "no-store",
  });
}

/** Things to sort out before booking, for the summary panel. */
export function getTripBuilderReadiness(tripId: string) {
  return fetchApi<{ readiness: string[] }>(apiRoutes.tripBuilder.readiness(tripId), {
    cache: "no-store",
  });
}

/** Create a trip assigned to the current member. */
export function createTripBuilderTrip(input: CreateTripBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trips, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Add a companion, confirm the named party, or make another client the lead. */
export function saveTripBuilderTraveller(
  tripId: string,
  input:
    | { client_id: string; party_role: "adult" | "child" }
    | { confirm: true }
    | { lead_client_id: string },
) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.travellers(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Remove a companion from the trip. */
export function removeTripBuilderTraveller(tripId: string, clientId: string) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.traveller(tripId, clientId), {
    method: "DELETE",
    cache: "no-store",
  });
}

/** Patch trip shell fields. */
export function updateTripBuilderTrip(tripId: string, input: UpdateTripBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.trip(tripId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Move the trip and every stay by the same number of days. */
export function shiftTripBuilderDates(tripId: string, input: ShiftTripDatesBody) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.shift(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Set one stay (hotel + city + dates). Pass leg_id to update that stay. */
export function setTripBuilderStay(tripId: string, input: SetTripStayBody) {
  return fetchApi<{ detail: TripDetail; property_match: StayPropertyMatch }>(
    apiRoutes.tripBuilder.stay(tripId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

/** Change city and dates on one stay. The hotel and party stay put. */
export function updateTripBuilderLeg(
  tripId: string,
  legId: string,
  input: UpdateTripLegBody,
) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.leg(tripId, legId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Remove one stay. Its pending booking is cancelled. */
export function removeTripBuilderLeg(tripId: string, legId: string) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.leg(tripId, legId), {
    method: "DELETE",
    cache: "no-store",
  });
}

/** Add another stay. City and dates only — the hotel is saved next. */
export function addTripBuilderLeg(tripId: string, input: AddTripLegBody) {
  return fetchApi<{ detail: TripDetail; leg_id: string }>(
    apiRoutes.tripBuilder.legs(tripId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );
}

export type AtlasStayReply = {
  matched: boolean;
  answer: string;
  place: { city: string | null; country: string | null };
  hotels: Array<{
    id: string;
    name: string;
    brand: string | null;
    city: string;
    propertyId: string | null;
    contractStatus: "contracted" | "not_yet_contracted" | "unknown";
  }>;
};

/** Stay-stage place and hotel questions, answered from Atlas. */
export function askTripBuilderAtlas(input: { question: string; city?: string | null }) {
  return fetchApi<AtlasStayReply>(apiRoutes.tripBuilder.atlas, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Search rates for the open trip stay. */
export function searchTripBuilderRates(input: SearchRatesBody) {
  return fetchApi<TripBuilderRateSearch>(apiRoutes.tripBuilder.ratesSearch, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Paste a hotel quote onto the trip (pending review). */
export function pasteTripBuilderLineItem(input: PasteLineItemBody) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemsPaste, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Persist a search option onto the trip (optionally select it). */
export function addTripBuilderRateOption(input: AddRateOptionBody) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemsFromRate, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Select a priced accommodation rate for the stay. */
export function selectTripBuilderLineItem(lineItemId: string) {
  return fetchApi<TripLineItem>(apiRoutes.tripBuilder.lineItemSelect(lineItemId), {
    method: "POST",
    cache: "no-store",
  });
}

/** Load quote draft + document status. */
export function getTripBuilderQuote(tripId: string) {
  return fetchApi<TripQuoteResponse>(apiRoutes.tripBuilder.quote(tripId), {
    cache: "no-store",
  });
}

/** Edit quote draft (narrative + optional sell fields). */
export function updateTripBuilderQuote(
  tripId: string,
  input: UpdateTripQuoteBody,
) {
  return fetchApi<TripQuoteResponse>(apiRoutes.tripBuilder.quote(tripId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Edit the client price or wording on a saved options-quote room. */
export function updateTripBuilderStayOption(
  lineItemId: string,
  input: UpdateStayOptionBody,
) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.lineItem(lineItemId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export type OptionsQuoteEditMatch = {
  id: string;
  label: string;
  text: string;
  after: string;
};

export type OptionsQuoteEditProposal =
  | { kind: "skip" }
  | { kind: "none"; message: string }
  | { kind: "matches"; matches: OptionsQuoteEditMatch[] };

/** Ask which lines a sentence would change. Nothing is saved. */
export function proposeTripBuilderOptionsEdit(tripId: string, message: string) {
  return fetchApi<OptionsQuoteEditProposal>(apiRoutes.tripBuilder.optionsEdit(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    cache: "no-store",
  });
}

/** Edit the title or note on the options quote. */
export function updateTripBuilderOptionsQuote(
  tripId: string,
  input: UpdateOptionsQuoteBody,
) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.options(tripId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Generate the options quote PDF. */
export function generateTripBuilderOptionsQuote(
  tripId: string,
  input: GenerateTripQuoteBody = {},
) {
  return fetchApi<TripDetail>(apiRoutes.tripBuilder.optionsGenerate(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

/** Short-lived signed URL for the options quote PDF. */
export function getTripBuilderOptionsQuoteUrl(tripId: string) {
  return fetchApi<{ url: string; expires_in: number }>(
    apiRoutes.tripBuilder.optionsUrl(tripId),
    { cache: "no-store" },
  );
}

const DEFAULT_CHAT_PAGE = 30;

/** Load a recent page of persisted studio chat messages. */
export function listTripChatMessages(
  tripId: string,
  params?: { limit?: number; before?: string },
) {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? DEFAULT_CHAT_PAGE));
  if (params?.before) search.set("before", params.before);
  return fetchApi<ChatMessagePage>(
    `${apiRoutes.tripBuilder.chat(tripId)}?${search.toString()}`,
    { cache: "no-store" },
  );
}

export type TripChatStreamHandlers = {
  onEvent: (event: ChatStreamEvent) => void;
};

/**
 * Send a chat message and consume NDJSON stream events.
 * Does not use fetchApi — response is a stream, not `{ success, data }`.
 */
async function consumeChatNdjsonStream(
  response: Response,
  handlers: TripChatStreamHandlers,
): Promise<void> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.includes("application/x-ndjson")) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    if (
      typeof body === "object" &&
      body !== null &&
      isApiErrorResponse(body as ApiErrorResponse)
    ) {
      throw new ApiRequestError(body as ApiErrorResponse, response.status);
    }
    throw new Error("Unexpected chat stream response.");
  }

  if (!response.body) {
    throw new Error("Chat stream body missing.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        handlers.onEvent(JSON.parse(line) as ChatStreamEvent);
      }
      newline = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    handlers.onEvent(JSON.parse(trailing) as ChatStreamEvent);
  }
}

/** Persist chat lines on a trip. No agent turn. */
export function saveTripBuilderChatLines(
  tripId: string,
  lines: { role: "user" | "assistant"; content: string }[],
) {
  return fetchApi<ChatMessage[]>(apiRoutes.tripBuilder.chatLines(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
    cache: "no-store",
  });
}

export async function streamTripChat(
  tripId: string,
  input: TripBuilderChatSendBody,
  handlers: TripChatStreamHandlers,
): Promise<void> {
  const response = await fetch(apiRoutes.tripBuilder.chat(tripId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  await consumeChatNdjsonStream(response, handlers);
}

/**
 * Pre-trip home chat — ephemeral NDJSON stream (no trip row).
 */
export async function streamPreTripChat(
  input: TripBuilderPreTripChatSendBody,
  handlers: TripChatStreamHandlers,
): Promise<void> {
  const response = await fetch(apiRoutes.tripBuilder.preTripChat, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  await consumeChatNdjsonStream(response, handlers);
}
