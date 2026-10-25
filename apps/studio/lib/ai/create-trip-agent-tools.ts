import type { ToolCallRef, TripAgentHandlers, TripChange } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile } from "@/lib/clients";
import { readRateSnapshot } from "@/lib/rates/rate-search-store";
import { getTripDetail, getTripReadiness, type TripDetail } from "@/lib/trip-builder";
import {
  addQuoteOptions,
  editQuoteLines,
  listQuoteLinesForAgent,
  previewQuote,
  proposeTripSplit,
  removeQuoteOption,
  removeTripStay,
  rewriteQuoteSection,
  selectQuoteFinal,
  sendQuote,
  setQuoteClientPrices,
  setQuoteWording,
  setTripClient,
  setTripDates,
  setTripStays,
  setTripTravellers,
  shiftTrip,
  undoTripChange,
  usePastedQuote,
  type TripChangeContext,
} from "@/lib/trip-builder/actions";
import { searchRatesForHotels } from "@/lib/trip-builder/rates/search-rates-for-hotels";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";
import { toTripFacts } from "./to-trip-facts";

type Options = DeskActor & { tripId: string };

/**
 * After a quote wording/price change, rebuild the PDF and attach its URL so the
 * browser opens the new file. Edit still succeeds if preview fails.
 */
async function withQuotePdfPreview(
  tripId: string,
  actor: { memberId: string },
  change: TripChange,
): Promise<TripChange> {
  if (change.unchanged) return change;
  try {
    const preview = await previewQuote(tripId, { force: true }, actor);
    return {
      ...change,
      summary: `${change.summary} The options quote is rebuilt and open.`,
      url: preview.url,
    };
  } catch {
    return change;
  }
}

/**
 * Handlers for the trip agent. The trip id comes from the server, never from the
 * model; each change is keyed by its tool call so a retry never applies it twice.
 */
export function createTripAgentTools(options: Options): TripAgentHandlers {
  const actor = { memberId: options.memberId };
  /** The trip as the last change left it; the agent's next reload uses it instead of the database. */
  let changed: TripDetail | null = null;
  /** The trip as this reply last saw it. The run lock keeps other replies from changing it meanwhile. */
  let latest: TripDetail | null = null;

  const change = (tool: string, args: Record<string, unknown>, call: ToolCallRef): TripChangeContext => ({
    tripId: options.tripId,
    actor,
    tool,
    args,
    idempotencyKey: call.id,
    loaded: latest,
    onChanged: (after) => {
      changed = after;
      latest = after;
    },
  });

  return {
    ...createDeskTools(options),

    async getTrip() {
      const detail = changed ?? (await getTripDetail(options.tripId, actor));
      changed = null;
      latest = detail;
      return toTripFacts(detail, await getTripReadiness(options.tripId, actor, detail));
    },

    async getClient({ clientId }) {
      const id = clientId ?? (latest ?? (await getTripDetail(options.tripId, actor))).client?.id;
      if (!id) {
        throw new AppError({
          userMessage: "No client on this trip yet. Pass client_id from client_search.",
          code: "ai.client_required",
          status: 400,
        });
      }
      return toClientBrief(await getClientProfile(id));
    },

    getRateSnapshot: () => readRateSnapshot(options.tripId),

    searchRates: (input) =>
      searchRatesForHotels(
        {
          tripId: options.tripId,
          destination: input.destination,
          hotels: input.hotels,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: input.rooms,
          adults: input.adults,
          children: input.children,
        },
        actor,
      ),

    setClient: (input, call) => setTripClient(change("trip_set_client", input, call), input),
    setTravellers: (input, call) => setTripTravellers(change("trip_set_travellers", input, call), input),
    setDates: (input, call) => setTripDates(change("trip_set_dates", input, call), input),
    setStays: (input, call) => setTripStays(change("trip_set_stays", input, call), input),
    removeStay: (input, call) => removeTripStay(change("trip_remove_stay", input, call), input),
    shiftDates: (input, call) => shiftTrip(change("trip_shift_dates", input, call), input),
    undo: (call) => undoTripChange(change("trip_undo", {}, call)),

    addQuoteOptions: (input, call) => addQuoteOptions(change("quote_add_options", input, call), input),
    setQuoteClientPrices: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await setQuoteClientPrices(change("quote_set_client_price", input, call), input),
      ),
    removeQuoteOption: (input, call) =>
      removeQuoteOption(change("quote_remove_option", input, call), input),
    setQuoteWording: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await setQuoteWording(change("quote_set_wording", input, call), input),
      ),
    editQuoteLines: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await editQuoteLines(change("quote_edit_lines", input, call), input),
      ),
    rewriteQuoteSection: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await rewriteQuoteSection(change("quote_rewrite_section", input, call), input),
      ),
    listQuoteLines: () => listQuoteLinesForAgent(options.tripId, actor),
    previewQuote: (input) => previewQuote(options.tripId, input, actor),
    usePastedQuote: (input, call) => usePastedQuote(change("rates_use_pasted_quote", input, call), input),
    sendQuote: (call) => sendQuote(change("quote_send", {}, call)),
    selectFinal: (input, call) =>
      selectQuoteFinal(change("quote_select_final", input, call), input),
    proposeSplit: (input) =>
      proposeTripSplit(options.tripId, input, actor, latest),
  };
}
