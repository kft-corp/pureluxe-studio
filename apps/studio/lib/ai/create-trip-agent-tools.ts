import type { ToolCallRef, TripAgentHandlers, TripChange } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile } from "@/lib/clients";
import { readRateSnapshot } from "@/lib/rates/rate-search-store";
import {
  getTripDetail,
  getTripReadiness,
  type TripDetail,
} from "@/lib/trip-builder";
import { loadChildAgeFacts } from "@/lib/trip-builder/party/child-ages-for-facts";
import {
  acceptAndSelectQuoteFinal,
  addQuoteLines,
  addQuoteOptions,
  clearQuoteSection,
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
import { recheckChosenRate } from "@/lib/trip-builder/rates/recheck-chosen-rate";
import { searchRatesForHotels } from "@/lib/trip-builder/rates/search-rates-for-hotels";

import { loadChatHistory } from "@/lib/trip-builder/chat/chat-history";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";
import { toTripFacts } from "./to-trip-facts";

type Options = DeskActor & { tripId: string };

/** Recent advisor lines so place follow-ups keep the destination they just named. */
async function recentPlaceEarlier(tripId: string): Promise<string | null> {
  try {
    const history = await loadChatHistory(tripId, { limit: 10, excludeId: null });
    const lines = history
      .filter((row) => row.role === "user")
      .slice(-4)
      .map((row) => row.content.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : null;
  } catch {
    return null;
  }
}

function tripCityHint(detail: TripDetail | null): string | null {
  if (!detail) return null;
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const cities = [...new Set(stays.map((stay) => stay.city?.trim()).filter(Boolean))];
  return cities[0] ?? null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Stay dates from the open trip (destination-matched stay, else first stay, else trip window).
 * Still injected into findHotels for call-site compatibility; open-GDS Hotel Search ignores them.
 */
function stayDatesForPlace(
  detail: TripDetail | null,
  place: string | null | undefined,
): { checkIn: string; checkOut: string } | null {
  if (!detail) return null;
  const stays =
    detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const needle = place?.trim().toLowerCase() || null;
  const matched = needle
    ? stays.find((stay) => {
        const city = stay.city?.trim().toLowerCase() ?? "";
        if (!city) return false;
        return city === needle || city.includes(needle) || needle.includes(city);
      })
    : null;
  const pick =
    matched ??
    stays.find(
      (stay) =>
        stay.check_in &&
        stay.check_out &&
        isIsoDate(stay.check_in) &&
        isIsoDate(stay.check_out) &&
        stay.check_out > stay.check_in,
    ) ??
    detail.stay;
  const checkIn = pick?.check_in?.trim() ?? "";
  const checkOut = pick?.check_out?.trim() ?? "";
  if (
    isIsoDate(checkIn) &&
    isIsoDate(checkOut) &&
    checkOut > checkIn
  ) {
    return { checkIn, checkOut };
  }
  const start = detail.trip?.starts_on?.trim() ?? "";
  const end = detail.trip?.ends_on?.trim() ?? "";
  if (isIsoDate(start) && isIsoDate(end) && end > start) {
    return { checkIn: start, checkOut: end };
  }
  return null;
}

/**
 * After a quote change, rebuild the PDF silently (no URL attach / no open).
 * Edit still succeeds if rebuild fails.
 */
async function withQuotePdfPreview(
  tripId: string,
  actor: { memberId: string },
  change: TripChange,
): Promise<TripChange> {
  if (change.unchanged) return change;
  try {
    await previewQuote(tripId, { force: true }, actor);
    return {
      ...change,
      summary: `${change.summary} The options quote is rebuilt.`,
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

  const desk = createDeskTools(options);

  async function loadTripDetailForTools() {
    let detail = latest ?? changed;
    if (!detail) {
      try {
        detail = await getTripDetail(options.tripId, actor);
      } catch {
        detail = null;
      }
    }
    return detail;
  }

  function partyFromDetail(detail: TripDetail | null | undefined) {
    const travellers = detail?.travellers ?? [];
    if (travellers.length === 0) return { adults: undefined, children: undefined };
    return {
      adults: travellers.filter((row) => row.party_role === "adult").length,
      children: travellers.filter(
        (row) => row.party_role === "child" || row.party_role === "infant",
      ).length,
    };
  }

  async function prefHintsFromLead(
    detail: TripDetail | null | undefined,
  ): Promise<string[] | undefined> {
    const clientId = detail?.trip?.primary_client_id?.trim();
    if (!clientId) return undefined;
    try {
      const profile = await getClientProfile(clientId);
      const hints: string[] = [];
      for (const pref of profile.client.preferences ?? []) {
        const label = pref.label?.trim();
        if (!label) continue;
        hints.push(pref.sentiment === "avoid" ? `avoid:${label}` : label);
      }
      for (const diet of profile.client.health_profile?.dietary_restrictions ?? []) {
        const line = diet?.trim();
        if (line) hints.push(line);
      }
      return hints.length > 0 ? hints : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    ...desk,

    async getPlaceNotes(input) {
      const earlier = input.earlier?.trim() || (await recentPlaceEarlier(options.tripId));
      const cityHint =
        input.cityHint?.trim() ||
        tripCityHint(latest) ||
        tripCityHint(changed) ||
        null;
      const detail = await loadTripDetailForTools();
      const stay =
        detail?.stays?.find((row) => row.check_in) ?? detail?.stay ?? null;
      const party = partyFromDetail(detail);
      return desk.getPlaceNotes({
        ...input,
        earlier: earlier ?? undefined,
        cityHint: cityHint ?? undefined,
        travelFrom: stay?.check_in ?? undefined,
        travelTo: stay?.check_out ?? undefined,
        adults: party.adults,
        children: party.children,
      });
    },

    async findHotels(input) {
      const detail = await loadTripDetailForTools();
      const party = partyFromDetail(detail);
      const prefHints = await prefHintsFromLead(detail);
      const ask =
        [input.destination, input.name, input.similarTo, input.priceBandLike]
          .filter(Boolean)
          .join(" ") || undefined;
      const stayDates = stayDatesForPlace(detail, input.destination ?? null);
      return desk.findHotels({
        ...input,
        adults: party.adults,
        children: party.children,
        ask: input.ask ?? ask,
        prefHints: input.prefHints ?? prefHints,
        checkIn: input.checkIn ?? stayDates?.checkIn ?? null,
        checkOut: input.checkOut ?? stayDates?.checkOut ?? null,
      });
    },

    async getTrip() {
      const detail = changed ?? (await getTripDetail(options.tripId, actor));
      changed = null;
      latest = detail;
      const [readiness, childAges] = await Promise.all([
        getTripReadiness(options.tripId, actor, detail),
        loadChildAgeFacts(detail),
      ]);
      return toTripFacts(detail, readiness, childAges);
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
          infants: input.infants,
          childAges: input.childAges,
          roomOccupancies: input.roomOccupancies,
          hotelCodes: input.hotelCodes,
        },
        actor,
      ),

    priceCheckRate: (input) =>
      recheckChosenRate(
        {
          tripId: options.tripId,
          lineItemId: input.lineItemId,
          hotel: input.hotel,
          room: input.room,
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

    addQuoteOptions: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await addQuoteOptions(change("quote_add_options", input, call), input),
      ),
    setQuoteClientPrices: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await setQuoteClientPrices(change("quote_set_client_price", input, call), input),
      ),
    removeQuoteOption: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await removeQuoteOption(change("quote_remove_option", input, call), input),
      ),
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
    addQuoteLines: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await addQuoteLines(change("quote_add_lines", input, call), input),
      ),
    clearQuoteSection: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await clearQuoteSection(change("quote_clear_section", input, call), input),
      ),
    rewriteQuoteSection: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await rewriteQuoteSection(change("quote_rewrite_section", input, call), input),
      ),
    listQuoteLines: () => listQuoteLinesForAgent(options.tripId, actor),
    previewQuote: (input) => previewQuote(options.tripId, input, actor),
    usePastedQuote: async (input, call) =>
      withQuotePdfPreview(
        options.tripId,
        actor,
        await usePastedQuote(change("rates_use_pasted_quote", input, call), input),
      ),
    sendQuote: (call) => sendQuote(change("quote_send", {}, call)),
    selectFinal: (input, call) =>
      selectQuoteFinal(change("quote_select_final", input, call), input),
    acceptAndSelect: (input, call) =>
      acceptAndSelectQuoteFinal(change("quote_accept_and_select", input, call), input),
    proposeSplit: (input) =>
      proposeTripSplit(options.tripId, input, actor, latest),
  };
}
