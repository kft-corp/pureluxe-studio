"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import type { AgentPhase } from "@pureluxe/ai";
import type { NormalizedRateOption } from "@pureluxe/rates";

import {
  addTripBuilderLeg,
  removeTripBuilderLeg,
  updateTripBuilderLeg,
  addTripBuilderRateOption,
  createTripBuilderTrip,
  generateTripBuilderOptionsQuote,
  getTripBuilderOptionsQuoteUrl,
  getTripBuilderTrip,
  listTripChatMessages,
  listTripBuilderTrips,
  pasteTripBuilderLineItem,
  searchClients,
  removeTripBuilderTraveller,
  saveTripBuilderChatLines,
  saveTripBuilderTraveller,
  askTripBuilderAtlas,
  searchTripBuilderRates,
  selectTripBuilderLineItem,
  setTripBuilderStay,
  shiftTripBuilderDates,
  streamPreTripChat,
  streamTripChat,
  updateTripBuilderQuote,
  updateTripBuilderOptionsQuote,
  proposeTripBuilderOptionsEdit,
  updateTripBuilderStayOption,
  updateTripBuilderTrip,
  type ClientSearchHit,
} from "@/lib/api";
import { showApiError, showSuccessToast } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import { isQuoteAccepted, isQuoteWithClient, isTripClosed } from "@/lib/trip-builder/trip-lock";
import type {
  ChatMessage,
  TripDetail,
  TripListItem,
  TripRateSnapshot,
  TripStaySnapshot,
} from "@/lib/trip-builder";

import {
  applyChatStreamEvent,
  makeOptimisticUserMessage,
} from "./apply-chat-stream-event";
import {
  clientNameFromMessage,
  isConfirmReply,
  isDeclineReply,
  parseAddStay,
  parseCityOnly,
  looksLikeHotelPlan,
  parseLeadChange,
  parseListedStayEdit,
  parseRemoveStay,
  parseTravellerCommand,
  parseTripDates,
  parseTripShift,
  wantsAddStay,
  wantsChangeTripDates,
  wantsAssignClient,
  wantsRateSearch,
  wantsHotelSearch,
  isPlaceQuestion,
  mightNamePlace,
  isTripQuestion,
} from "./chat-intent";
import {
  parseQuoteEdit,
} from "./parse-quote-edit";
import {
  mergeStayDraft,
  parseStayMessage,
  partyReady,
  stayAskText,
  stayDraftReady,
  type StayDraft,
} from "./parse-stay-message";
import { cancellationForStay, explainRate } from "./explain-rate";
import { questionUsesRatePack } from "@/lib/rates/rate-search-pack";
import {
  answerPriceQuestion,
  clientPriceAtMarkup,
  formatRoomMoney,
  markupPercentFromNotes,
  type PricedRoom,
} from "@/lib/rates/price-math";
import {
  isPriceSkip,
  parseMoneyReply,
  parseOptionClientPrice,
  parseOptionsWording,
  looksLikeOptionsPdfEdit,
  splitTrailingPrice,
  wantsOptionsPreview,
  type MoneyReply,
} from "./options-quote-guide";
import { isOptionsAdd, matchRateChoice } from "./parse-rate-choice";
import { buildQuoteBreakup, nightsLabel, stayNightCount } from "./quote-price";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import type { TripBuilderRateCard, TripBuilderStayNotes } from "./trip-builder-rate-card";
import {
  findOverlappingStay,
  isRateStage,
  legsConfirmed,
  partyFromTravellers,
  resolveTripStage,
  staysAwaitingRoom,
  travellersConfirmed,
  stayIsComplete,
  staysOutsideWindow,
  tripStays,
} from "./stages";

const CHAT_PAGE_SIZE = 30;

type UseTripBuilderOptions = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
  prefillClientId?: string | null;
};

const EMPTY_STAY: StayDraft = {
  hotel: "",
  city: "",
  checkIn: "",
  checkOut: "",
  adults: null,
  children: null,
  rooms: null,
};

type SavedRate = TripDetail["rates"]["candidates"][number];

type ListedRate =
  | { title: string; kind: "search"; option: NormalizedRateOption }
  | { title: string; kind: "saved"; row: SavedRate };

function stayOn(
  detail: TripDetail | null,
  legId: string | null,
): TripStaySnapshot | null {
  const stays = tripStays(detail);
  return stays.find((stay) => stay.leg_id === legId) ?? stays[0] ?? null;
}

function withPartyCounts(draft: StayDraft, detail: TripDetail | null): StayDraft {
  if (!travellersConfirmed(detail)) return draft;
  const party = partyFromTravellers(detail);
  if (party.adults < 1) return draft;
  return { ...draft, adults: party.adults, children: party.children };
}

function whoElseText(detail: TripDetail): string {
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

function partySentence(detail: TripDetail): string {
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

function draftFromStay(stay: TripStaySnapshot | null): StayDraft {
  if (!stay) return EMPTY_STAY;
  return {
    hotel: stay.property_name ?? "",
    city: stay.city ?? "",
    checkIn: stay.check_in ?? "",
    checkOut: stay.check_out ?? "",
    adults: stay.adults,
    children: stay.children,
    rooms: stay.rooms,
  };
}

/** Search rows win. Saved trip rates show only when this session has no fresh search. */
function listedRates(
  options: NormalizedRateOption[],
  saved: SavedRate[],
  legId: string | null,
): ListedRate[] {
  if (options.length > 0) {
    return options.slice(0, 6).map((option) => ({
      title: option.room_name || option.property_name || option.rate_source_code,
      kind: "search" as const,
      option,
    }));
  }
  return saved
    .filter((row) => !row.selected && (!legId || row.leg_id === legId))
    .slice(0, 6)
    .map((row) => ({
      title: row.title,
      kind: "saved" as const,
      row,
    }));
}

function shortStayDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "12 Oct – 20 Oct · 8 nights". */
function stayRangeLabel(checkIn: string, checkOut: string): string {
  const nights = stayNightCount(checkIn, checkOut);
  return `${shortStayDate(checkIn)} – ${shortStayDate(checkOut)}${nights ? ` · ${nightsLabel(nights)}` : ""}`;
}

function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "";
  const code = currency?.trim() || "";
  const figure = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return code ? `${code} ${figure}` : figure;
}

function stayFieldsDiffer(
  draft: StayDraft,
  stay: {
    property_name: string | null;
    city: string;
    check_in: string | null;
    check_out: string | null;
    adults: number | null;
    children: number | null;
    rooms: number | null;
  },
): boolean {
  return (
    draft.hotel.trim() !== (stay.property_name ?? "").trim() ||
    draft.city.trim() !== stay.city.trim() ||
    draft.checkIn !== (stay.check_in ?? "") ||
    draft.checkOut !== (stay.check_out ?? "") ||
    draft.adults !== stay.adults ||
    draft.children !== stay.children ||
    draft.rooms !== stay.rooms
  );
}

function staySavedText(input: {
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

function looksLikeSupplierQuote(text: string): boolean {
  return (
    /(?:USD|EUR|GBP|CHF|AED|\$|€|£)\s*[0-9]/i.test(text) ||
    /(?:total|rate|cost|price|amount)\s*[:=]?\s*[0-9]/i.test(text)
  );
}

/** A supplier total to save. A question that mentions a price is not one. */
function isSupplierPaste(text: string): boolean {
  if (!looksLikeSupplierQuote(text)) return false;
  if (isTripQuestion(text)) return false;
  if (/\?\s*$/.test(text.trim())) return false;
  return true;
}

function parseSellMessage(
  text: string,
): { sell_total: number; sell_currency: string } | null {
  const match = text.match(
    /\bsell(?:\s*(?:price|total))?\s*[:=]?\s*([A-Z]{3})?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Z]{3})?\b/i,
  );
  if (!match) return null;
  const amount = Number(match[2]);
  if (!Number.isFinite(amount)) return null;
  const currency = (match[1] || match[3] || "USD").toUpperCase();
  return { sell_total: amount, sell_currency: currency };
}

function shiftLabel(days: number): string {
  const count = Math.abs(days);
  return `${count} day${count === 1 ? "" : "s"} ${days > 0 ? "later" : "earlier"}`;
}

/**
 * One chip leads (the first primary or danger); other primaries become secondary.
 * The "no" chip sits right after the lead so yes and no are side by side.
 */
function rankChips(chips: TripBuilderChip[], decline: TripBuilderChip | null): TripBuilderChip[] {
  const leadIndex = chips.findIndex(
    (chip) => chip.variant === "primary" || chip.variant === "danger",
  );
  const declines = decline ? [decline] : [];
  if (leadIndex < 0) return [...chips, ...declines];
  const rest = chips
    .filter((_, index) => index !== leadIndex)
    .map((chip) => (chip.variant === "primary" ? { ...chip, variant: "secondary" as const } : chip));
  return [chips[leadIndex]!, ...declines, ...rest];
}

type ConfirmFocus =
  | "trip-dates"
  | "shift-trip"
  | "date-drop"
  | "remove-stay"
  | "revise-stay"
  | "add-stay"
  | "stay-overlap"
  | "stay-update"
  | "lead"
  | "traveller"
  | "role"
  | "rate-search"
  | "assign"
  | "paste"
  | "sell"
  | "quote"
  | "add-option"
  | "select-room"
  | "options-text"
  | "options-preview"
  | "options-edit";

/** Label for the chip that says "no" to the pending confirmation. */
const DECLINE_LABELS: Partial<Record<ConfirmFocus, string>> = {
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

type OptionDraft = {
  title: string;
  currency: string | null;
  costLabel: string;
  /** Client price on the options quote. Null for search results and unpriced rooms. */
  sellLabel: string | null;
  option: NormalizedRateOption | null;
  lineItemId: string | null;
};

type OptionCommit = OptionDraft & {
  mode: "add" | "price";
  amount: number | null;
};

type PartyChoice = {
  id: string;
  display_name: string;
  party_role: "adult" | "child";
};

/** Points the advisor to the trip page once the client quote is ready to send. */
function sendHandoff(detail: TripDetail): string {
  if (detail.trip.status !== "building") return "";
  return `\n\nWhen you send it to the client, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and mark **Sent to client** under Update status.`;
}

const AFTER_ACCEPT_STEPS = [
  "**Before you book**",
  "1. Tap **Check availability** to see today's availability and hotel price for this room.",
  "2. If the hotel price changed, tap **Use today's cost** to update the team cost.",
  "3. Tap **Set client price** if the client price needs to change.",
  "4. Book with the hotel, then set the booking to confirmed in **Bookings**.",
].join("\n");

/** What the room choice did to prices: the room's quoted client price, team cost, and the trip total. */
function choiceSummary(
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

type CostUpdate = {
  lineItemId: string;
  room: string;
  amount: number;
  currency: string;
};

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
function priceCheck(
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
  const header = `**Price check · ${room}**\n\nTeam cost on file **${onFile}**${sell ? `. Client price **${sell}**` : ""}.`;
  const today = matchChosenRoom(chosen, options);
  if (!today) {
    return {
      note: `${header}\n\nThis room is not in today's results, so check availability with the hotel before you book. You can still set the client price.`,
      update: null,
    };
  }
  const availability = AVAILABILITY_LABELS[today.availability_status];
  const todayCost = formatMoney(today.cost_internal, today.currency);
  const sameCurrency =
    !chosen.currency ||
    chosen.currency.trim().toUpperCase() === today.currency.trim().toUpperCase();
  const changed = sameCurrency && today.cost_internal !== chosen.cost_internal;
  const lines = [header, `Today: **${availability}**, team cost **${todayCost}**.`];
  if (!sameCurrency) {
    lines.push("Today's price is in a different currency, so compare it with the hotel before you book.");
  } else if (!changed) {
    lines.push("The team cost has not changed. Book with the hotel, then confirm the booking in **Bookings**.");
  } else {
    lines.push(
      `The team cost has changed. Tap **Use today's cost** to update the room and the pending booking, then set the client price if it needs to change.`,
    );
  }
  return {
    note: lines.join("\n\n"),
    update: changed
      ? { lineItemId: chosen.id, room, amount: today.cost_internal, currency: today.currency }
      : null,
  };
}

function clipQuoteLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 140).trim()}…` : clean;
}

export function useTripBuilder({
  initialTrips,
  initialDetail,
  canWrite: canWriteProp,
  prefillClientId = null,
}: UseTripBuilderOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripParam = searchParams.get("trip");

  const [trips, setTrips] = useState(initialTrips);
  const [detail, setDetail] = useState<TripDetail | null>(initialDetail);
  const canWrite = canWriteProp && !(detail && isTripClosed(detail.trip.status));
  /** The client accepted this quote. The options PDF stays as sent until the quote is reopened. */
  const quoteFrozen = Boolean(detail && isQuoteAccepted(detail.trip.status));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rateOptions, setRateOptions] = useState<NormalizedRateOption[]>([]);
  const [rateStayNotes, setRateStayNotes] = useState<TripBuilderStayNotes | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(() => Boolean(initialDetail));
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(null);
  const [clientHits, setClientHits] = useState<ClientSearchHit[]>([]);
  const [suggestedClients, setSuggestedClients] = useState<
    { id: string; display_name: string }[]
  >([]);
  const [pendingAssign, setPendingAssign] = useState<ClientSearchHit | null>(
    null,
  );
  const [pendingTraveller, setPendingTraveller] = useState<{
    id: string;
    display_name: string;
    party_role: "adult" | "child";
  } | null>(null);
  const [pendingLead, setPendingLead] = useState<ClientSearchHit | null>(null);
  const [leadHits, setLeadHits] = useState<ClientSearchHit[]>([]);
  const [pendingRole, setPendingRole] = useState<PartyChoice | null>(null);
  const [roleHits, setRoleHits] = useState<PartyChoice[]>([]);
  const [confirmFocus, setConfirmFocus] = useState<ConfirmFocus | null>(null);
  const [quietChips, setQuietChips] = useState(false);
  const firstLegId =
    initialDetail?.stays?.[0]?.leg_id ?? initialDetail?.stay?.leg_id ?? null;
  const activeLegIdRef = useRef<string | null>(firstLegId);
  const [activeLegId, setActiveLegId] = useState<string | null>(firstLegId);
  const [stayDraft, setStayDraft] = useState<StayDraft>(() =>
    draftFromStay(stayOn(initialDetail, firstLegId)),
  );
  const [pendingTripDates, setPendingTripDates] = useState<{
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [pendingShift, setPendingShift] = useState<number | null>(null);
  const [offerReopen, setOfferReopen] = useState(false);
  const [pendingLeg, setPendingLeg] = useState<{
    city: string;
    checkIn: string;
    checkOut: string;
    confirmOverlap: boolean;
  } | null>(null);
  const [pendingDateDrop, setPendingDateDrop] = useState<{
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [pendingRevise, setPendingRevise] = useState<{
    legId: string;
    city: string;
    checkIn: string;
    checkOut: string;
    confirmOverlap: boolean;
  } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    legId: string;
    city: string;
  } | null>(null);
  const [pendingStayOverlap, setPendingStayOverlap] = useState(false);
  const [pendingStayUpdate, setPendingStayUpdate] = useState(false);
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const [pendingSell, setPendingSell] = useState<{
    sell_total: number;
    sell_currency: string;
  } | null>(null);
  const [pendingOptionDraft, setPendingOptionDraft] = useState<OptionDraft | null>(null);
  const [pendingOptionCommit, setPendingOptionCommit] = useState<OptionCommit | null>(null);
  const [pendingOptionSelect, setPendingOptionSelect] = useState<OptionDraft | null>(null);
  /** Today's hotel price for the client's chosen room, offered after a price check. */
  const [pendingCostUpdate, setPendingCostUpdate] = useState<CostUpdate | null>(null);
  const [pendingOptionsText, setPendingOptionsText] = useState<{
    field: "title" | "notes";
    value: string;
  } | null>(null);
  const [pendingPdfEdit, setPendingPdfEdit] = useState<
    { id: string; label: string; before: string; after: string }[] | null
  >(null);
  const [pendingRateSearch, setPendingRateSearch] = useState(false);
  const [atlasPlace, setAtlasPlace] = useState<{
    city: string | null;
    country: string | null;
  } | null>(null);
  const atlasPlaceRef = useRef(atlasPlace);
  atlasPlaceRef.current = atlasPlace;
  const [atlasHotels, setAtlasHotels] = useState<
    Array<{
      id: string;
      name: string;
      brand: string | null;
      city: string;
      propertyId: string | null;
      contractStatus: "contracted" | "not_yet_contracted" | "unknown";
    }>
  >([]);
  const chatLoadedForTripRef = useRef<string | null>(null);
  const skipChatLoadForTripRef = useRef<string | null>(null);

  function resetChatUi() {
    setMessages([]);
    setChatLoading(false);
    setChatLoadingOlder(false);
    setHasMoreMessages(false);
    setStreamingContent(null);
    setAgentPhase(null);
    setClientHits([]);
    setSuggestedClients([]);
    setPendingAssign(null);
    setRateOptions([]);
    setPendingPaste(null);
    setPendingSell(null);
    setPendingRateSearch(false);
    setPendingTripDates(null);
    setPendingLeg(null);
    setPendingDateDrop(null);
    setPendingRevise(null);
    setPendingRemove(null);
    setPendingStayOverlap(false);
    setPendingLead(null);
    setLeadHits([]);
    setPendingRole(null);
    setRoleHits([]);
    setPendingTraveller(null);
    setConfirmFocus(null);
    setQuietChips(false);
  }

  function chooseLeg(legId: string | null) {
    activeLegIdRef.current = legId;
    setActiveLegId(legId);
  }

  function hydrateStayDraft(next: TripDetail | null, legId = activeLegIdRef.current) {
    const stay = stayOn(next, legId);
    if (stay && stay.leg_id !== activeLegIdRef.current) {
      chooseLeg(stay.leg_id);
    }
    setStayDraft(withPartyCounts(draftFromStay(stay), next));
  }

  function selectLeg(legId: string) {
    if (!detail || legId === activeLegIdRef.current) return;
    chooseLeg(legId);
    setStayDraft(withPartyCounts(draftFromStay(stayOn(detail, legId)), detail));
    setRateOptions([]);
    setPendingRateSearch(false);
    setPendingPaste(null);
  }

  async function loadChatMessages(tripId: string) {
    setChatLoading(true);
    setChatLoadingOlder(false);
    setStreamingContent(null);
    setAgentPhase(null);
    try {
      const response = await listTripChatMessages(tripId, {
        limit: CHAT_PAGE_SIZE,
      });
      setMessages(response.data.messages);
      setHasMoreMessages(response.data.hasMore);
    } catch (error) {
      showApiError(error);
      setMessages([]);
      setHasMoreMessages(false);
    } finally {
      setChatLoading(false);
    }
  }

  async function loadOlderMessages() {
    const tripId = detail?.trip.id;
    const oldest = messages[0];
    if (
      !tripId ||
      !oldest ||
      !hasMoreMessages ||
      chatLoading ||
      chatLoadingOlder
    ) {
      return;
    }

    setChatLoadingOlder(true);
    try {
      const response = await listTripChatMessages(tripId, {
        limit: CHAT_PAGE_SIZE,
        before: oldest.created_at,
      });
      setMessages((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const older = response.data.messages.filter((row) => !seen.has(row.id));
        return older.length > 0 ? [...older, ...prev] : prev;
      });
      setHasMoreMessages(response.data.hasMore);
    } catch (error) {
      showApiError(error);
    } finally {
      setChatLoadingOlder(false);
    }
  }

  const syncFromUrl = useEffectEvent(async (tripId: string | null) => {
    if (!tripId) {
      setDetail(null);
      setSummaryOpen(false);
      resetChatUi();
      chooseLeg(null);
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
      skipChatLoadForTripRef.current = null;
      return;
    }

    try {
      if (detail?.trip.id !== tripId) {
        setChatLoading(true);
        setMessages([]);
        setHasMoreMessages(false);
        setStreamingContent(null);
        setAgentPhase(null);
        const response = await getTripBuilderTrip(tripId);
        const opened = stayOn(response.data, null);
        chooseLeg(opened?.leg_id ?? null);
        setDetail(response.data);
        hydrateStayDraft(response.data, opened?.leg_id ?? null);
        setClientHits([]);
        setPendingAssign(null);
        setRateOptions([]);
        setPendingPaste(null);
        setPendingSell(null);
        chatLoadedForTripRef.current = null;
      }

      if (skipChatLoadForTripRef.current === tripId) {
        skipChatLoadForTripRef.current = null;
        chatLoadedForTripRef.current = tripId;
        setChatLoading(false);
        return;
      }

      if (chatLoadedForTripRef.current !== tripId) {
        chatLoadedForTripRef.current = tripId;
        await loadChatMessages(tripId);
      }
    } catch (error) {
      showApiError(error);
      router.replace(pageRoutes.tripBuilder);
      setDetail(null);
      resetChatUi();
      setStayDraft(EMPTY_STAY);
      chatLoadedForTripRef.current = null;
    }
  });

  useEffect(() => {
    void syncFromUrl(tripParam);
  }, [tripParam]);

  async function refreshTrips() {
    try {
      const response = await listTripBuilderTrips({ limit: 20 });
      setTrips(response.data.trips);
    } catch {
      // Keep current list.
    }
  }

  async function refreshAfterMutation(tripId: string) {
    const [detailResponse] = await Promise.all([
      getTripBuilderTrip(tripId),
      refreshTrips(),
    ]);
    setDetail(detailResponse.data);
    hydrateStayDraft(detailResponse.data);
    return detailResponse.data;
  }

  function openTrip(tripId: string) {
    if (detail?.trip.id === tripId && chatLoadedForTripRef.current === tripId) {
      return;
    }
    setChatLoading(true);
    setMessages([]);
    setHasMoreMessages(false);
    setStreamingContent(null);
    setAgentPhase(null);
    if (detail?.trip.id !== tripId) {
      setDetail(null);
    }
    chatLoadedForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilderTrip(tripId));
    });
  }

  /** Clear to home — does not insert a trip. */
  function newChat() {
    setSummaryOpen(false);
    setDetail(null);
    resetChatUi();
    chooseLeg(null);
    setStayDraft(EMPTY_STAY);
    chatLoadedForTripRef.current = null;
    skipChatLoadForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilder);
    });
  }

  async function createTrip(clientId?: string | null, clientName?: string) {
    if (!canWrite) return null;
    setBusy(true);
    try {
      const response = await createTripBuilderTrip({
        primary_client_id: clientId ?? prefillClientId ?? null,
      });
      setDetail(response.data);
      setClientHits([]);
      setSuggestedClients([]);
      setPendingAssign(null);
      setRateOptions([]);
      setPendingPaste(null);
      setPendingSell(null);
      setStreamingContent(null);
      setAgentPhase(null);
      setHasMoreMessages(false);
      setChatLoading(false);
      chooseLeg(null);
      hydrateStayDraft(response.data, null);
      skipChatLoadForTripRef.current = response.data.trip.id;
      chatLoadedForTripRef.current = response.data.trip.id;
      await refreshTrips();
      const name =
        response.data.client?.display_name?.trim() || clientName?.trim();
      const kept = messages
        .filter((row) => !row.incomplete && row.content.trim())
        .map((row) => ({ role: row.role, content: row.content }));
      const userLine = name ? `Create trip for ${name}` : "Create trip";
      const assistant = createdTripReply(response.data);
      const lines = [
        ...kept,
        { role: "user" as const, content: userLine },
        { role: "assistant" as const, content: assistant.content },
      ].slice(-40);
      try {
        const saved = await saveTripBuilderChatLines(
          response.data.trip.id,
          lines,
        );
        setMessages(saved.data);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          localChatMessage("user", userLine),
          assistant,
        ]);
        showApiError(error);
      }
      router.replace(pageRoutes.tripBuilderTrip(response.data.trip.id));
      return response.data;
    } catch (error) {
      showApiError(error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function assignClient(clientId: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        primary_client_id: clientId,
      });
      setDetail(response.data);
      setClientHits([]);
      setPendingAssign(null);
      setConfirmFocus(null);
      setPendingTraveller(null);
      await refreshTrips();
      showSuccessToast("Client saved.");
      const lead = response.data.client?.display_name?.trim() || "Client";
      void appendTurn(`Add ${lead}`, whoElseText(response.data));
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveStayFromDraft(confirmOverlap = false) {
    if (!canWrite || !detail || !stayDraftReady(stayDraft)) return;
    if (detail.pricing_locked) {
      showApiError(new Error("Pricing is locked on this trip."));
      return;
    }
    const openStay = stayOn(detail, activeLegIdRef.current);
    const clash = findOverlappingStay(
      tripStays(detail),
      stayDraft.checkIn,
      stayDraft.checkOut,
      openStay?.leg_id,
    );
    if (clash && !confirmOverlap) {
      setPendingStayOverlap(true);
      setConfirmFocus("stay-overlap");
      appendTurn(
        `Save stay · ${stayDraft.hotel}`,
        `**${stayDraft.city}** ${stayDraft.checkIn} to ${stayDraft.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to save anyway, or **no** to keep the current dates.`,
      );
      return;
    }
    const hadRate = Boolean(
      openStay &&
        detail.rates.candidates.some(
          (rate) => rate.selected && rate.leg_id === openStay.leg_id,
        ) &&
        (openStay.check_in !== stayDraft.checkIn ||
          openStay.check_out !== stayDraft.checkOut ||
          (openStay.property_name ?? "").trim().toLowerCase() !==
            stayDraft.hotel.trim().toLowerCase()),
    );
    const quoteNote = quoteRefreshNote();
    setPendingStayOverlap(false);
    setBusy(true);
    try {
      const hotel = stayDraft.hotel.trim();
      const savedName = openStay?.property_name?.trim() ?? "";
      const response = await setTripBuilderStay(detail.trip.id, {
        leg_id: openStay?.leg_id ?? null,
        city: stayDraft.city.trim(),
        property_name: hotel,
        property_id:
          hotel.toLowerCase() === savedName.toLowerCase()
            ? (openStay?.property_id ?? null)
            : null,
        check_in: stayDraft.checkIn,
        check_out: stayDraft.checkOut,
        adults: travellersConfirmed(detail)
          ? partyFromTravellers(detail).adults
          : (stayDraft.adults ?? 0),
        children: travellersConfirmed(detail)
          ? partyFromTravellers(detail).children
          : (stayDraft.children ?? 0),
        rooms: stayDraft.rooms ?? 0,
        confirm_overlap: confirmOverlap,
      });
      const saved = response.data.detail;
      setDetail(saved);
      await refreshTrips();
      const stay = stayOn(saved, openStay?.leg_id ?? null);
      const party = `${stayDraft.adults} adults, ${stayDraft.children} children, ${stayDraft.rooms} ${stayDraft.rooms === 1 ? "room" : "rooms"}`;
      const nextStay = tripStays(saved).find((item) => !stayIsComplete(item));
      if (nextStay) {
        chooseLeg(nextStay.leg_id);
        hydrateStayDraft(saved, nextStay.leg_id);
      } else {
        hydrateStayDraft(saved, openStay?.leg_id ?? null);
      }
      const savedText = staySavedText({
        hotel: stay?.property_name ?? hotel,
        city: stay?.city ?? stayDraft.city.trim(),
        checkIn: stay?.check_in ?? stayDraft.checkIn,
        checkOut: stay?.check_out ?? stayDraft.checkOut,
        party,
        status: response.data.property_match.status,
        names: response.data.property_match.names,
      });
      const rateNote = hadRate
        ? "\n\nThe selected rate was cleared. Search rates again for these dates."
        : "";
      appendTurn(
        `Save stay · ${stay?.property_name ?? hotel} · ${stay?.city ?? stayDraft.city}`,
        nextStay
          ? `${savedText}\n\nNext, plan **${nextStay.city}**, ${nextStay.check_in} to ${nextStay.check_out}. Send the hotel and party for that stay, then tap **Save stay**.${rateNote}${quoteNote}`
          : `${savedText}${rateNote}${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function matchAtlasPick(
    message: string,
    hotels: typeof atlasHotels,
  ) {
    const numbered = message.match(/^(?:select|use|pick|choose)\s+(\d+)\b/i);
    if (numbered) {
      const index = Number(numbered[1]) - 1;
      return hotels[index] ?? null;
    }
    const lower = message.trim().toLowerCase().replace(/[?.!]+$/g, "");
    return (
      hotels.find(
        (hotel) =>
          lower === hotel.name.toLowerCase() ||
          lower === `use ${hotel.name.toLowerCase()}`,
      ) ?? null
    );
  }

  async function useAtlasHotel(
    hotel: (typeof atlasHotels)[number],
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) {
      setStayDraft((current) => ({
        ...current,
        hotel: hotel.name,
        city: hotel.city || current.city,
      }));
      setAtlasHotels([]);
      void appendTurn(
        userLine,
        `**${hotel.name}** in **${hotel.city}** is the hotel to use. Set the trip start and end next, save the stay, then ask me to search rates when you are ready.`,
      );
      return;
    }
    const stayCity = openStay.city.trim().toLowerCase();
    const hotelCity = hotel.city.trim().toLowerCase();
    const samePlace =
      !hotelCity ||
      stayCity === hotelCity ||
      stayCity.includes(hotelCity) ||
      hotelCity.includes(stayCity);
    if (!samePlace) {
      void appendTurn(
        userLine,
        `**${hotel.name}** is on file for **${hotel.city}**. The open stay is **${openStay.city}**. Open that stay, or add **${hotel.city}**, then choose the hotel.`,
      );
      return;
    }
    const named = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
    const adults = named && named.adults >= 1 ? named.adults : (stayDraft.adults ?? openStay.adults);
    const children =
      named && named.adults >= 1 ? named.children : (stayDraft.children ?? openStay.children ?? 0);
    const rooms = stayDraft.rooms ?? openStay.rooms;
    if (adults == null || rooms == null) {
      setStayDraft((current) => ({
        ...current,
        hotel: hotel.name,
        city: openStay.city,
        checkIn: openStay.check_in ?? current.checkIn,
        checkOut: openStay.check_out ?? current.checkOut,
        adults: adults ?? current.adults,
        children,
      }));
      void appendTurn(
        userLine,
        adults == null
          ? `**${hotel.name}** is the hotel for **${openStay.city}**. Finish the traveller list first, then send **Rooms: 1**.`
          : `**${hotel.name}** is the hotel for **${openStay.city}**. Send **Rooms: 1**, then tap **Use ${hotel.name}**.`,
      );
      return;
    }
    setBusy(true);
    try {
      const response = await setTripBuilderStay(detail.trip.id, {
        leg_id: openStay.leg_id,
        city: openStay.city,
        property_name: hotel.name,
        property_id: hotel.propertyId,
        check_in: openStay.check_in,
        check_out: openStay.check_out,
        adults,
        children,
        rooms,
      });
      setDetail(response.data.detail);
      hydrateStayDraft(response.data.detail, openStay.leg_id);
      await refreshTrips();
      const linked = hotel.propertyId
        ? "Ask me to search rates when you are ready."
        : "This hotel is saved. A rate search may not find a price yet. You can still search or paste a supplier quote when you are ready.";
      appendTurn(
        userLine,
        `Saved **${hotel.name}** on **${openStay.city}**, ${openStay.check_in} to ${openStay.check_out}. ${linked}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function askAtlas(message: string, city: string | null): Promise<boolean> {
    try {
      const response = await askTripBuilderAtlas({ question: message, city });
      if (response.data.place.city || response.data.place.country) {
        setAtlasPlace(response.data.place);
      }
      if (!response.data.matched) {
        setAtlasHotels([]);
        return false;
      }
      setAtlasHotels(response.data.hotels);
      if (response.data.hotels.length > 0) setQuietChips(false);
      return false;
    } catch (error) {
      showApiError(error);
      return true;
    }
  }

  async function addTraveller(
    person: { id: string; display_name: string; party_role: "adult" | "child" },
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setPendingTraveller(null);
    setClientHits([]);
    setConfirmFocus(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        client_id: person.id,
        party_role: person.party_role,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const kind = person.party_role === "child" ? "child" : "adult";
      const followUp = response.data.trip.travellers_confirmed_at
        ? "Stay counts follow this list."
        : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `Added **${person.display_name}** as a ${kind}. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmTravellers(userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setPendingTraveller(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, { confirm: true });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      appendTurn(
        userLine,
        `Travellers are set: ${partySentence(response.data)}\n\nYou can ask what a country or city is like, or ask me to search hotels there. I only use what is on file.\n\nWhen you are ready, set the trip start and end. Every stay has to sit inside those days.\n\nStart: 2026-10-10\nEnd: 2026-10-20`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function changeLead(person: ClientSearchHit, userLine: string) {
    if (!canWrite || !detail) return;
    const before = partyFromTravellers(detail);
    const previous = detail.client?.display_name?.trim() || "The previous lead";
    setBusy(true);
    setPendingLead(null);
    setLeadHits([]);
    setConfirmFocus(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        lead_client_id: person.id,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const after = partyFromTravellers(response.data);
      const countsChanged = before.adults !== after.adults || before.children !== after.children;
      if (countsChanged) {
        setRateOptions([]);
      }
      const followUp = response.data.trip.travellers_confirmed_at
        ? countsChanged
          ? "Stay counts follow this list. The selected rate was cleared, so search rates again."
          : "Stay counts follow this list."
        : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `**${person.display_name}** is now the lead. **${previous}** stays on the trip. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerLead(name: string, userLine: string) {
    if (!detail) return;
    setBusy(true);
    setPendingTraveller(null);
    setPendingAssign(null);
    setPendingRateSearch(false);
    setPendingRole(null);
    setRoleHits([]);
    clearStayPrompts();
    try {
      const response = await searchClients({ q: name, limit: 8 });
      const currentId = detail.client?.id ?? null;
      const hits = response.data.clients.filter((client) => client.id !== currentId);
      if (hits.length === 0) {
        setPendingLead(null);
        setLeadHits([]);
        setConfirmFocus(null);
        appendTurn(
          userLine,
          response.data.clients.length > 0
            ? `**${detail.client?.display_name ?? name}** is already the lead.`
            : `**${name}** is not a client yet. Add them in Clients → New client, then ask to make them the lead.`,
        );
        return;
      }
      if (hits.length === 1) {
        const hit = hits[0]!;
        setLeadHits([]);
        setPendingLead(hit);
        setConfirmFocus("lead");
        appendTurn(
          userLine,
          `Make **${hit.display_name}** the lead? **${detail.client?.display_name ?? "The current lead"}** stays on the trip. Say **yes** or tap **Make ${hit.display_name} the lead**.`,
        );
        return;
      }
      setPendingLead(null);
      setLeadHits(hits);
      setConfirmFocus(null);
      appendTurn(
        userLine,
        `Several clients match **${name}**. Tap **Make … the lead** for the right person. The current lead stays on the trip.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeTraveller(clientId: string, name: string, userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await removeTripBuilderTraveller(detail.trip.id, clientId);
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      appendTurn(userLine, `Removed **${name}**. ${partySentence(response.data)}`);
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerTraveller(name: string, child: boolean, userLine: string) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await searchClients({ q: name, limit: 8 });
      const onTrip = new Set(detail.travellers.map((person) => person.client_id));
      const hits = response.data.clients.filter((client) => !onTrip.has(client.id));
      setPendingTraveller(null);
      setPendingLead(null);
      setLeadHits([]);
      setPendingRole(null);
      setRoleHits([]);
      if (hits.length === 0) {
        setClientHits([]);
        setConfirmFocus(null);
        appendTurn(
          userLine,
          response.data.clients.length > 0
            ? `**${name}** is already on this trip.`
            : `**${name}** is not a client yet. Add them in Clients → New client, then come back and say their name.`,
        );
        return;
      }
      if (hits.length === 1) {
        const hit = hits[0]!;
        setClientHits([]);
        setPendingTraveller({
          id: hit.id,
          display_name: hit.display_name,
          party_role: child ? "child" : "adult",
        });
        setConfirmFocus("traveller");
        appendTurn(
          userLine,
          `Add **${hit.display_name}**${child ? " as a child" : ""}? Say **yes** or tap **Add ${hit.display_name}**.`,
        );
        return;
      }
      setClientHits(hits);
      setConfirmFocus(null);
      appendTurn(
        userLine,
        `Several clients match **${name}**. Tap the right **Add** chip.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function travellersNamed(name: string) {
    if (!detail) return [];
    const needle = name.trim().toLowerCase();
    const exact = detail.travellers.filter(
      (person) => person.display_name.trim().toLowerCase() === needle,
    );
    if (exact.length > 0) return exact;
    return detail.travellers.filter((person) => {
      const display = person.display_name.trim().toLowerCase();
      return display.includes(needle) || needle.includes(display);
    });
  }

  async function setPartyRole(person: PartyChoice, userLine: string) {
    if (!canWrite || !detail) return;
    const before = partyFromTravellers(detail);
    setBusy(true);
    setPendingRole(null);
    setRoleHits([]);
    setConfirmFocus(null);
    try {
      const response = await saveTripBuilderTraveller(detail.trip.id, {
        client_id: person.id,
        party_role: person.party_role,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data, activeLegIdRef.current);
      await refreshTrips();
      const after = partyFromTravellers(response.data);
      const countsChanged = before.adults !== after.adults || before.children !== after.children;
      if (countsChanged) {
        setRateOptions([]);
      }
      const kind = person.party_role === "child" ? "a child" : "an adult";
      const followUp =
        response.data.trip.travellers_confirmed_at && countsChanged
          ? "Stay counts follow this list. The selected rate was cleared, so search rates again."
          : response.data.trip.travellers_confirmed_at
            ? "Stay counts follow this list."
            : "Add someone else, or say **just them** when the list is complete.";
      appendTurn(
        userLine,
        `**${person.display_name}** is now ${kind}. ${partySentence(response.data)}\n\n${followUp}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerRole(name: string, role: "adult" | "child", userLine: string) {
    if (!detail) return;
    setPendingLead(null);
    setLeadHits([]);
    setPendingTraveller(null);
    setPendingRole(null);
    setRoleHits([]);
    const kind = role === "child" ? "a child" : "an adult";
    if (name.toLowerCase() === "lead") {
      setConfirmFocus(null);
      void appendTurn(userLine, "The lead stays an adult.");
      return;
    }
    const matches = travellersNamed(name).filter((person) => person.role !== "primary");
    if (matches.length === 0) {
      const leadOnly = travellersNamed(name).some((person) => person.role === "primary");
      setConfirmFocus(null);
      void appendTurn(
        userLine,
        leadOnly ? "The lead stays an adult." : `**${name}** is not on this trip.`,
      );
      return;
    }
    const ready = matches.filter((person) => person.party_role !== role);
    if (ready.length === 0) {
      setConfirmFocus(null);
      void appendTurn(
        userLine,
        `**${matches[0]?.display_name ?? name}** is already ${kind}.`,
      );
      return;
    }
    if (ready.length === 1) {
      const person = ready[0]!;
      const choice = {
        id: person.client_id,
        display_name: person.display_name,
        party_role: role,
      };
      setPendingRole(choice);
      setConfirmFocus("role");
      void appendTurn(
        userLine,
        `Make **${person.display_name}** ${kind}? Say **yes** or tap **Make ${person.display_name} ${kind}**.`,
      );
      return;
    }
    setConfirmFocus(null);
    setRoleHits(
      ready.map((person) => ({
        id: person.client_id,
        display_name: person.display_name,
        party_role: role,
      })),
    );
    void appendTurn(
      userLine,
      `Several travellers match **${name}**. Tap **Make … ${kind}** for the right person.`,
    );
  }

  async function searchRates(source?: StayDraft, userLine = "Search rates") {
    const party = source ?? stayDraft;
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) return;
    const namedParty = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
    const adults = namedParty && namedParty.adults >= 1 ? namedParty.adults : party.adults;
    const children = namedParty && namedParty.adults >= 1 ? namedParty.children : party.children;
    if (adults == null || children == null || party.rooms == null) {
      void appendTurn(
        userLine,
        adults == null
          ? "Finish the traveller list, then send the rooms. For example **Rooms: 1**."
          : "I still need the rooms before I search. For example **Rooms: 1**.",
      );
      return;
    }
    let checkIn = openStay.check_in;
    let checkOut = openStay.check_out;
    let legId = openStay.leg_id;
    let city = party.city.trim() || openStay.city;
    let propertyId = openStay.property_id;
    setPendingRateSearch(false);
    setConfirmFocus(null);
    setBusy(true);
    try {
      if (!detail.pricing_locked && stayFieldsDiffer(party, openStay)) {
        const hotel = party.hotel.trim();
        const savedName = openStay.property_name?.trim() ?? "";
        const saved = await setTripBuilderStay(detail.trip.id, {
          leg_id: legId,
          city,
          property_name: hotel || openStay.property_name,
          property_id:
            hotel.toLowerCase() === savedName.toLowerCase() ? propertyId : null,
          check_in: openStay.check_in,
          check_out: openStay.check_out,
          adults,
          children,
          rooms: party.rooms,
        });
        setDetail(saved.data.detail);
        hydrateStayDraft(saved.data.detail);
        const next = stayOn(saved.data.detail, legId);
        if (!next?.check_in || !next.check_out) return;
        legId = next.leg_id;
        city = next.city;
        propertyId = next.property_id;
        checkIn = next.check_in;
        checkOut = next.check_out;
        if (!propertyId) {
          const rooms =
            party.rooms === 1 ? "1 room" : `${party.rooms} rooms`;
          appendTurn(
            userLine,
            staySavedText({
              hotel: next.property_name ?? hotel,
              city: next.city,
              checkIn: next.check_in,
              checkOut: next.check_out,
              party: `${adults} adults, ${children} children, ${rooms}`,
              status: saved.data.property_match.status,
              names: saved.data.property_match.names,
            }),
          );
          return;
        }
      }
      const response = await searchTripBuilderRates({
        trip_id: detail.trip.id,
        leg_id: legId,
        destination_text: city,
        property_id: propertyId,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        rooms: party.rooms,
        paste_text: null,
      });
      const options = [...response.data.options].sort(
        (a, b) => Number(b.recommended) - Number(a.recommended),
      );
      setRateOptions(options);
      setRateStayNotes(response.data.stay_notes);
      const found = describeRateSearch(
        options,
        response.data.message,
        adults,
        children,
        party.rooms,
        response.data.stay_notes?.markup ?? null,
      );
      if (detail.pricing_locked) {
        const check = priceCheck(detail, legId, options);
        setPendingCostUpdate(check.update);
        appendTurn(userLine, `${check.note}\n\n${found}`);
      } else {
        appendTurn(userLine, found);
      }
      await refreshAfterMutation(detail.trip.id);
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function selectSearchOption(
    option: NormalizedRateOption,
    userLine?: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await addTripBuilderRateOption({
        trip_id: detail.trip.id,
        leg_id: stayOn(detail, activeLegIdRef.current)?.leg_id ?? null,
        option,
        select: true,
      });
      await refreshAfterMutation(detail.trip.id);
      setRateOptions([]);
      setPendingPaste(null);
      const name =
        option.room_name || option.property_name || option.rate_source_code;
      const money = formatMoney(option.cost_internal, option.currency);
      appendTurn(
        userLine ?? (money ? `Select · ${name} · ${money}` : `Select · ${name}`),
        `**${name}** is the room for this stay. The other options were removed. A pending hotel booking is in **Bookings**. The client PDF is the options quote.\n\nOpen **Bookings** and set it to confirmed only after you check the stay.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function draftFromChoice(choice: ListedRate): OptionDraft {
    if (choice.kind === "search") {
      const explained = explainRate(choice.option);
      return {
        title: explained.room,
        currency: choice.option.currency?.trim().toUpperCase() || null,
        costLabel: explained.price,
        sellLabel: null,
        option: choice.option,
        lineItemId: null,
      };
    }
    const title = choice.row.subtitle?.trim() || choice.row.title;
    return {
      title,
      currency: choice.row.currency?.trim().toUpperCase() || null,
      costLabel: formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card",
      sellLabel: formatMoney(choice.row.sell_amount, choice.row.currency) || null,
      option: null,
      lineItemId: choice.row.id,
    };
  }

  function roomFacts(choice: ListedRate): string {
    if (choice.kind === "search") {
      const explained = explainRate(choice.option);
      return [
        `**${explained.room}**`,
        `Team cost **${explained.price}**. ${explained.why}`,
        explained.occupancy ? `Occupancy: ${explained.occupancy}.` : null,
        explained.benefits.length > 0
          ? `Included: ${explained.benefits.join(", ")}.`
          : "Nothing is listed as included.",
        explained.cancellation
          ? `Cancellation: ${explained.cancellation}`
          : "Cancellation is not on file.",
        rateStayNotes?.markup ?? null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n");
    }
    const title = choice.row.subtitle?.trim() || choice.row.title;
    const included = choice.row.inclusions.map((item) => item.trim()).filter(Boolean);
    const cancel = choice.row.cancellation_policy?.trim();
    const sell = formatMoney(choice.row.sell_amount, choice.row.currency);
    return [
      `**${title}**`,
      sell
        ? `Client price on the options quote **${sell}**. Team cost **${formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card"}**.`
        : `Team cost **${formatMoney(choice.row.cost_internal, choice.row.currency) || "on the card"}**. No client price is set on the options quote for this room.`,
      included.length > 0 ? `Included: ${included.join(", ")}.` : "Nothing is listed as included.",
      cancel ? `Cancellation: ${cancel}` : "Cancellation is not on file.",
      rateStayNotes?.markup ?? null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n\n");
  }

  function optionChipLabel(commit: OptionCommit): string {
    const room = commit.title.length > 32 ? `${commit.title.slice(0, 32).trim()}…` : commit.title;
    const money = formatMoney(commit.amount, commit.currency);
    if (commit.mode === "price") return money ? `Set price · ${room} · ${money}` : `Set price · ${room}`;
    return money ? `Add · ${room} · ${money}` : `Add · ${room} · price later`;
  }

  function armOptionCommit(commit: OptionCommit, userLine: string, preface?: string) {
    setPendingOptionDraft(null);
    setPendingOptionCommit(commit);
    setPendingOptionSelect(null);
    setConfirmFocus("add-option");
    setQuietChips(false);
    const money = formatMoney(commit.amount, commit.currency);
    const priceLine =
      commit.amount == null
        ? "The client price stays empty, so the PDF prints To be confirmed."
        : `Client price **${money}**. The team cost stays **${commit.costLabel}**.`;
    const action =
      commit.mode === "price"
        ? `Set the client price for **${commit.title}**?`
        : `Save **${commit.title}** on the options quote?`;
    void appendTurn(
      userLine,
      [
        preface,
        action,
        priceLine,
        `Say **yes** or tap **${optionChipLabel(commit)}**. Say **no** to cancel.`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n"),
    );
  }

  function markupSuggestion(cost: number | null, currency: string | null): string | null {
    const percent = markupPercentFromNotes(rateStayNotes?.markup ?? null);
    if (percent == null || cost == null) return null;
    const suggested = formatRoomMoney(clientPriceAtMarkup(cost, percent), currency);
    return `At the minimum markup of ${percent}% on file, the client price would be **${suggested}**. Send that amount, or a different one.`;
  }

  function roomsForPriceMath(): PricedRoom[] {
    if (!detail) return [];
    if (rateOptions.length > 0) {
      return rateOptions.slice(0, 6).map((option) => {
        const title = option.room_name || option.property_name || "Room";
        const saved = detail.rates.candidates.find((row) => {
          const label = `${row.subtitle ?? ""} ${row.title}`.toLowerCase();
          return !row.selected && label.includes(title.toLowerCase());
        });
        return {
          title,
          teamCost: option.cost_internal,
          clientPrice: saved?.sell_amount ?? null,
          currency: option.currency,
        };
      });
    }
    const legId = activeLegIdRef.current;
    return detail.rates.candidates
      .filter((row) => row.cost_internal != null && (!legId || row.leg_id === legId))
      .slice(0, 8)
      .map((row) => ({
        title: row.subtitle?.trim() || row.title,
        teamCost: row.cost_internal ?? 0,
        clientPrice: row.selected ? null : row.sell_amount,
        currency: row.currency,
      }));
  }

  function offerAddRoom(choice: ListedRate, price: MoneyReply | null, userLine: string) {
    const draft = draftFromChoice(choice);
    if (price?.currency && draft.currency && price.currency !== draft.currency) {
      setPendingOptionDraft(draft);
      setConfirmFocus(null);
      void appendTurn(
        userLine,
        `**${draft.title}** is priced in **${draft.currency}**. Send the client price in ${draft.currency}.`,
      );
      return;
    }
    if (choice.kind === "saved" && !price) {
      const current = formatMoney(choice.row.sell_amount, choice.row.currency);
      setPendingOptionDraft(draft);
      setConfirmFocus(null);
      void appendTurn(
        userLine,
        current
          ? `**${draft.title}** is already on the options quote. Client price **${current}**. Team cost **${draft.costLabel}**. Send a new amount to change it, for example **2400 ${draft.currency ?? "USD"}**.`
          : `**${draft.title}** is already on the options quote. Team cost **${draft.costLabel}**.\n\nWhat client price should the PDF show? Send the amount, for example **2400 ${draft.currency ?? "USD"}**, or say **to be confirmed**.`,
      );
      return;
    }
    if (!price) {
      setPendingOptionDraft(draft);
      setPendingOptionCommit(null);
      setConfirmFocus(null);
      const cost = choice.kind === "search" ? choice.option.cost_internal : choice.row.cost_internal;
      const suggest = markupSuggestion(cost, draft.currency);
      void appendTurn(
        userLine,
        [
          roomFacts(choice),
          suggest,
          `What client price should this room show? Send the amount in **${draft.currency ?? "the room currency"}**, for example **2400 ${draft.currency ?? "USD"}**. Say **to be confirmed** to add it with no price yet.`,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n\n"),
      );
      return;
    }
    armOptionCommit(
      {
        ...draft,
        mode: choice.kind === "saved" ? "price" : "add",
        amount: price.amount,
        currency: price.currency ?? draft.currency,
      },
      userLine,
      roomFacts(choice),
    );
  }

  function offerSelectRoom(choice: ListedRate, userLine: string) {
    const draft = draftFromChoice(choice);
    setPendingOptionDraft(null);
    setPendingOptionCommit(null);
    setPendingOptionSelect(draft);
    setConfirmFocus("select-room");
    setQuietChips(false);
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    void appendTurn(
      userLine,
      `${roomFacts(choice)}\n\nThis is the room the client chose. The other options for this stay come off, and a pending booking is created.\n\nSay **yes** or tap **Client chose · ${room}**. Say **no** to cancel.`,
    );
  }

  function offerChooseSaved(lineItemId: string) {
    if (!detail) return;
    const row = detail.rates.candidates.find((item) => item.id === lineItemId && !item.selected);
    if (!row) return;
    if (detail.pricing_locked && row.sell_amount == null) {
      void appendTurn(
        "Client chose this",
        "This room has no client price on the accepted quote, so it cannot be chosen while pricing is locked. Reopen the quote on the trip page to price it.",
      );
      return;
    }
    const choice: ListedRate = {
      title: row.subtitle?.trim() || row.title,
      kind: "saved",
      row,
    };
    const draft = draftFromChoice(choice);
    setPendingOptionDraft(null);
    setPendingOptionCommit(null);
    setPendingOptionSelect(draft);
    setConfirmFocus("select-room");
    setQuietChips(false);
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    void appendTurn(
      "Client chose this",
      `**${draft.title}** stays. ${
        draft.sellLabel
          ? `Client price on the options quote **${draft.sellLabel}**, and that becomes the trip's client price once every stay has a room. Team cost **${draft.costLabel}**.`
          : `Team cost **${draft.costLabel}**. No client price is set on the options quote for this room, so set the client price after choosing.`
      } The other options for this stay come off, and a pending booking is created.\n\nSay **yes** or tap **Client chose · ${room}**. Say **no** to cancel.`,
    );
  }

  /** Ask for a new client price on the client's chosen room. The reply runs the usual price confirm. */
  function offerRoomPrice(row: SavedRate, userLine: string) {
    const draft = draftFromChoice({
      title: row.subtitle?.trim() || row.title,
      kind: "saved",
      row,
    });
    setPendingOptionSelect(null);
    setPendingOptionCommit(null);
    setPendingOptionDraft(draft);
    setConfirmFocus(null);
    setQuietChips(false);
    void appendTurn(
      userLine,
      `**${draft.title}**: client price ${draft.sellLabel ? `**${draft.sellLabel}**` : "not set"}. Team cost **${draft.costLabel}**.\n\nSend the new client price, for example **2400 ${draft.currency ?? "USD"}**. The trip price and the pending booking update with it.`,
    );
  }

  async function commitCostUpdate(update: CostUpdate) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setPendingCostUpdate(null);
    const money = formatMoney(update.amount, update.currency);
    try {
      const response = await updateTripBuilderStayOption(update.lineItemId, {
        cost_internal: update.amount,
      });
      setDetail(response.data);
      const row = response.data.rates.candidates.find((item) => item.id === update.lineItemId);
      const sell = row ? formatMoney(row.sell_amount, row.currency) : "";
      appendTurn(
        `Use today's cost · ${money}`,
        `Team cost for **${update.room}** is now **${money}**. The pending booking and the margin are updated.${
          sell ? ` The client price stays **${sell}**.` : ""
        }\n\nTap **Set client price** if the client price needs to change, or book with the hotel and confirm the booking in **Bookings**.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  function acceptDraftPrice(userLine: string) {
    const draft = pendingOptionDraft;
    if (!draft) return;
    if (isPriceSkip(userLine) && quoteFrozen) {
      void appendTurn(
        userLine,
        `The client accepted this trip, so **${draft.title}** needs a client price. Send the amount, for example **2400 ${draft.currency ?? "USD"}**.`,
      );
      return;
    }
    if (isPriceSkip(userLine)) {
      armOptionCommit(
        {
          ...draft,
          mode: draft.option ? "add" : "price",
          amount: null,
          currency: draft.currency,
        },
        userLine,
      );
      return;
    }
    const price = parseMoneyReply(userLine);
    if (!price) return;
    if (price.currency && draft.currency && price.currency !== draft.currency) {
      void appendTurn(
        userLine,
        `**${draft.title}** is priced in **${draft.currency}**. Send the client price in ${draft.currency}.`,
      );
      return;
    }
    armOptionCommit(
      {
        ...draft,
        mode: draft.option ? "add" : "price",
        amount: price.amount,
        currency: price.currency ?? draft.currency,
      },
      userLine,
    );
  }

  async function commitOption(commit: OptionCommit, userLine: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setConfirmFocus(null);
    setPendingOptionCommit(null);
    setPendingOptionDraft(null);
    const backToBuilding = isQuoteWithClient(detail.trip.status)
      ? "\n\nThe client's copy is now out of date, so the trip is back in **Building**. Regenerate the options quote and send it again."
      : "";
    try {
      if (commit.mode === "price" && commit.lineItemId) {
        const response = await updateTripBuilderStayOption(commit.lineItemId, {
          sell_amount: commit.amount,
        });
        setDetail(response.data);
        const offer =
          commit.amount == null
            ? "To be confirmed"
            : formatMoney(commit.amount, commit.currency);
        if (quoteFrozen) {
          const total = formatMoney(response.data.trip.sell_total, response.data.trip.sell_currency);
          appendTurn(
            userLine,
            `Client price for **${commit.title}** is **${offer}**. The team cost stays **${commit.costLabel}**.${
              total ? ` The trip client price is **${total}**.` : ""
            } The pending booking and the margin are updated, and the trip stays in **Booking**.\n\nBook with the hotel, then confirm the booking in **Bookings**.`,
          );
          return;
        }
        appendTurn(
          userLine,
          `Client price for **${commit.title}** is **${offer}**. The team cost stays **${commit.costLabel}**.\n\nSay **show the options quote** to see the PDF, or add another room.${backToBuilding}`,
        );
        return;
      }
      if (!commit.option) return;
      const created = await addTripBuilderRateOption({
        trip_id: detail.trip.id,
        leg_id: stayOn(detail, activeLegIdRef.current)?.leg_id ?? null,
        option: commit.option,
        select: false,
      });
      if (commit.amount != null) {
        const response = await updateTripBuilderStayOption(created.data.id, {
          sell_amount: commit.amount,
        });
        setDetail(response.data);
      } else {
        await refreshAfterMutation(detail.trip.id);
      }
      const offer =
        commit.amount == null
          ? "To be confirmed"
          : formatMoney(commit.amount, commit.currency);
      appendTurn(
        userLine,
        `Added **${commit.title}** to the options quote. Client price **${offer}**. Team cost **${commit.costLabel}**.\n\nAdd another room the same way, say **show the options quote** to see the PDF, or set the wording with **note:**.${backToBuilding}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitSelect(draft: OptionDraft, userLine: string) {
    setPendingOptionSelect(null);
    setConfirmFocus(null);
    if (draft.option) {
      await selectSearchOption(draft.option, userLine);
      return;
    }
    if (draft.lineItemId) await selectCandidate(draft.lineItemId, userLine);
  }

  function offerOptionsText(
    edit: { field: "title" | "notes"; value: string },
    userLine: string,
  ) {
    setPendingOptionsText(edit);
    setConfirmFocus("options-text");
    setQuietChips(false);
    const label = edit.field === "title" ? "Set options title" : "Set options note";
    void appendTurn(
      userLine,
      `Save this ${edit.field} on the options quote?\n\n${edit.value}\n\nSay **yes** or tap **${label}**. Say **no** to cancel.`,
    );
  }

  async function commitOptionsText(
    edit: { field: "title" | "notes"; value: string },
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setConfirmFocus(null);
    setPendingOptionsText(null);
    try {
      const response = await updateTripBuilderOptionsQuote(detail.trip.id, {
        ...(edit.field === "title" ? { title: edit.value } : { notes: edit.value }),
      });
      setDetail(response.data);
      appendTurn(
        userLine,
        `Saved the options ${edit.field}. Say **show the options quote** to see it.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitPdfEdits(
    matches: { id: string; label: string; before: string; after: string }[],
    userLine: string,
  ) {
    if (!canWrite || !detail || matches.length === 0) return;
    setBusy(true);
    setConfirmFocus(null);
    setPendingPdfEdit(null);
    try {
      const response = await updateTripBuilderOptionsQuote(detail.trip.id, {
        line_edits: matches.map((row) => ({ id: row.id, text: row.after })),
      });
      setDetail(response.data);
      const changed = matches.length === 1 ? "that line" : `${matches.length} lines`;
      appendTurn(
        userLine,
        `Saved ${changed} on the options quote. Say **show the options quote** to open the new PDF.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerPdfEdit(message: string): Promise<boolean> {
    if (!detail) return false;
    setBusy(true);
    try {
      const response = await proposeTripBuilderOptionsEdit(detail.trip.id, message);
      const proposal = response.data;
      if (proposal.kind === "skip") return false;
      if (proposal.kind === "none") {
        void appendTurn(message, proposal.message);
        return true;
      }
      const matches = proposal.matches.map((row) => ({
        id: row.id,
        label: row.label,
        before: row.text,
        after: row.after,
      }));
      if (matches.length === 0) {
        void appendTurn(message, "That text is not on the options quote.");
        return true;
      }
      setPendingPdfEdit(matches);
      setConfirmFocus("options-edit");
      setQuietChips(false);
      if (matches.length === 1) {
        const row = matches[0]!;
        const from = row.before ? `${clipQuoteLine(row.before)} → ` : "";
        void appendTurn(
          message,
          `Change this line?\n\n**${row.label}**\n${from}${clipQuoteLine(row.after)}\n\nSay **yes** or tap **Change this line**. Say **no** to cancel.`,
        );
        return true;
      }
      const list = matches
        .map((row) => {
          const from = row.before ? `${clipQuoteLine(row.before)} → ` : "";
          return `- **${row.label}**: ${from}${clipQuoteLine(row.after)}`;
        })
        .join("\n");
      void appendTurn(
        message,
        `That text is on ${matches.length} lines. Change every line, or only one?\n\n${list}\n\nSay **yes** to change every line. Say **no** to cancel.`,
      );
      return true;
    } catch (error) {
      showApiError(error);
      return true;
    } finally {
      setBusy(false);
    }
  }

  function offerOptionsPreview(userLine: string) {
    if (!detail) return;
    const doc = detail.options_quote.document;
    const ready = doc?.status === "ready" && Boolean(doc.has_file);
    const canRebuild = detail.rates.candidates.length > 0;
    if (!canRebuild && !doc?.has_file) {
      void appendTurn(
        userLine,
        "Add a room first. Say **add** and the room name, then the client price.",
      );
      return;
    }
    if (ready || doc?.has_file) {
      void openOptionsQuote(userLine);
      return;
    }
    setConfirmFocus("options-preview");
    setQuietChips(false);
    void appendTurn(
      userLine,
      "I'll build the options quote from the rooms saved so far. A missing client price prints as To be confirmed.\n\nSay **yes** or tap **Open options quote**. Say **no** to cancel.",
    );
  }

  async function openOptionsQuote(userLine?: string) {
    if (!detail) return;
    setConfirmFocus(null);
    const doc = detail.options_quote.document;
    const ready = doc?.status === "ready" && Boolean(doc.has_file);
    const canRebuild = detail.rates.candidates.length > 0;
    if (!canRebuild && !doc?.has_file) {
      if (userLine) {
        void appendTurn(userLine, "Add a room first. Say **add** and the room name.");
      }
      return;
    }
    // A sent or accepted quote opens as it is. Rebuilding it would replace the PDF the client has.
    const keepSent = quoteFrozen || isQuoteWithClient(detail.trip.status);
    if (keepSent && !doc?.has_file) {
      if (userLine) void appendTurn(userLine, "There is no options quote file on this trip yet.");
      return;
    }
    setBusy(true);
    try {
      if (canWrite && canRebuild && !ready && !keepSent) {
        const generated = await generateTripBuilderOptionsQuote(detail.trip.id, {
          force: true,
        });
        setDetail(generated.data);
      }
      const response = await getTripBuilderOptionsQuoteUrl(detail.trip.id);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      if (userLine) {
        appendTurn(
          userLine,
          keepSent
            ? "This is the options quote the client has."
            : `The options quote is open. A room with no client price prints as To be confirmed.${sendHandoff(detail)}`,
        );
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateOptionsQuote(userLine = "Regenerate options quote") {
    if (!canWrite || !detail) return;
    if (quoteFrozen) {
      void appendTurn(
        userLine,
        `The client accepted this quote, so the PDF stays as sent. To change it, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and choose **Reopen quote** under Update status.`,
      );
      return;
    }
    if (detail.rates.candidates.length === 0) {
      void appendTurn(userLine, "Add a room first. Then the options quote can be rebuilt.");
      return;
    }
    const wasWithClient = isQuoteWithClient(detail.trip.status);
    setBusy(true);
    setConfirmFocus(null);
    try {
      const generated = await generateTripBuilderOptionsQuote(detail.trip.id, { force: true });
      setDetail(generated.data);
      const response = await getTripBuilderOptionsQuoteUrl(detail.trip.id);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      appendTurn(
        userLine,
        wasWithClient
          ? `The options quote is rebuilt and open. The client has the old one, so the trip is back to **Building**.${sendHandoff(generated.data)}`
          : `The options quote is rebuilt and open.${sendHandoff(generated.data)}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function pasteQuote(pasteText: string) {
    if (!canWrite || !detail) return;
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!openStay?.check_in || !openStay.check_out) return;
    setBusy(true);
    setConfirmFocus(null);
    try {
      const created = await pasteTripBuilderLineItem({
        trip_id: detail.trip.id,
        leg_id: openStay.leg_id,
        property_id: openStay.property_id,
        property_name: openStay.property_name,
        check_in: openStay.check_in,
        check_out: openStay.check_out,
        currency: "USD",
        paste_text: pasteText,
      });
      await selectTripBuilderLineItem(created.data.id);
      await refreshAfterMutation(detail.trip.id);
      setPendingPaste(null);
      appendTurn(
        "Use pasted quote",
        "Saved and selected that pasted quote. The amount is advisor cost, not the client price.\n\nNext, set the client sell price, for example **sell 4500 USD**.",
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function selectCandidate(lineItemId: string, userLine?: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await selectTripBuilderLineItem(lineItemId);
      const next = await refreshAfterMutation(detail.trip.id);
      const row = detail.rates.candidates.find((item) => item.id === lineItemId);
      const money = row ? formatMoney(row.cost_internal, row.currency) : "";
      const room = row?.subtitle?.trim() || row?.title || "That room";
      appendTurn(
        userLine ??
          (row
            ? money
              ? `Select · ${row.title} · ${money}`
              : `Select · ${row.title}`
            : "Select rate"),
        `${choiceSummary(room, row ?? null, next)}\n\n${
          quoteFrozen
            ? AFTER_ACCEPT_STEPS
            : isQuoteWithClient(detail.trip.status)
              ? `The trip keeps its status. When the client agrees to the quote, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and mark **Client accepted** under Update status.`
              : "The client PDF is the options quote. Open **Bookings** and set it to confirmed only after you check the stay."
        }`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function applySell() {
    if (!canWrite || !detail || !pendingSell) return;
    setBusy(true);
    setConfirmFocus(null);
    try {
      const response = await updateTripBuilderQuote(detail.trip.id, {
        sell_total: pendingSell.sell_total,
        sell_currency: pendingSell.sell_currency,
      });
      const next = response.data.detail;
      const sell = pendingSell;
      setPendingSell(null);
      setDetail(next);
      appendTurn(
        `Set sell ${sell.sell_currency} ${sell.sell_total}`,
        `Client sell price is **${sell.sell_currency} ${sell.sell_total}**. It stays on this trip. The booking stays pending in **Bookings**.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  /** Status changes (sent, accepted, reopen) live on the trip page. */
  function openTripPage() {
    if (!detail) return;
    router.push(pageRoutes.trip(detail.trip.id));
  }

  /** Home chat — no trip yet (search_clients / get_client only). */
  async function sendHomeChat(message: string) {
    if (!canWrite || chatBusy) return;

    const clientRequestId = crypto.randomUUID();
    const optimisticUser = makeOptimisticUserMessage(message, clientRequestId);
    const history = messages
      .filter((row) => !row.incomplete && row.content.trim())
      .map((row) => ({ role: row.role, content: row.content }));

    setChatBusy(true);
    setMessages((prev) => [...prev, optimisticUser]);
    setStreamingContent("");
    setAgentPhase("thinking");

    try {
      await streamPreTripChat(
        { message, history, client_request_id: clientRequestId },
        {
          onEvent: (event) =>
            applyChatStreamEvent({
              event,
              optimisticId: optimisticUser.id,
              setMessages,
              setStreamingContent,
              setAgentPhase,
              onClients: rememberClients,
              showError: showApiError,
            }),
        },
      );
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setMessages((prev) =>
        prev.filter((row) => row.id !== optimisticUser.id),
      );
      showApiError(error);
    } finally {
      setChatBusy(false);
    }
  }

  /** Trip chat — persisted messages + full trip tools. */
  async function sendTripChat(
    message: string,
    tripOverride?: TripDetail | null,
  ) {
    const activeTrip = tripOverride ?? detail;
    if (!canWrite || !activeTrip || chatBusy) return;

    const tripId = activeTrip.trip.id;
    const clientRequestId = crypto.randomUUID();
    const optimisticUser = makeOptimisticUserMessage(message, clientRequestId);

    setChatBusy(true);
    setMessages((prev) => [...prev, optimisticUser]);
    setStreamingContent("");
    setAgentPhase("thinking");

    try {
      await streamTripChat(
        tripId,
        { message, client_request_id: clientRequestId },
        {
          onEvent: (event) =>
            applyChatStreamEvent({
              event,
              optimisticId: optimisticUser.id,
              setMessages,
              setStreamingContent,
              setAgentPhase,
              showError: showApiError,
              onError: () => {
                void loadChatMessages(tripId);
              },
            }),
        },
      );
    } catch (error) {
      setStreamingContent(null);
      setAgentPhase(null);
      setMessages((prev) =>
        prev.filter((row) => row.id !== optimisticUser.id),
      );
      showApiError(error);
      void loadChatMessages(tripId);
    } finally {
      setChatBusy(false);
    }
  }

  function rememberClients(clients: { id: string; display_name: string }[]) {
    setSuggestedClients((prev) => {
      const byId = new Map(prev.map((client) => [client.id, client]));
      for (const client of clients) byId.set(client.id, client);
      return [...byId.values()].slice(-6);
    });
  }

  async function appendTurn(userText: string, assistantText: string) {
    setMessages((prev) => [
      ...prev,
      localChatMessage("user", userText),
      localChatMessage("assistant", assistantText),
    ]);
    const tripId = detail?.trip.id;
    if (!tripId) return;
    try {
      await saveTripBuilderChatLines(tripId, [
        { role: "user", content: userText },
        { role: "assistant", content: assistantText },
      ]);
    } catch (error) {
      showApiError(error);
    }
  }

  function describeRateSearch(
    options: NormalizedRateOption[],
    message: string | null,
    adults: number,
    children: number,
    rooms: number,
    markup: string | null,
  ): string {
    const party = `${adults} adults, ${children} children, ${rooms} ${rooms === 1 ? "room" : "rooms"}`;
    if (options.length === 0) {
      const note = message?.trim();
      return note
        ? `${note}\n\nPaste a supplier quote in chat, with the total, and I'll confirm it before saving.`
        : "No rates came back for this stay. Paste a supplier quote in chat, with the total, and I'll confirm it before saving.";
    }
    const first = explainRate(options[0]);
    const hotel = options[0].property_name?.trim() || first.room;
    const from = shortStayDate(options[0].check_in);
    const to = shortStayDate(options[0].check_out);
    const count = Math.min(options.length, 6);
    const rateWord = count === 1 ? "1 rate" : `${count} rates`;
    const markupPercent = markupPercentFromNotes(markup);
    const lines = options.slice(0, 6).map((option, index) => {
      const explained = explainRate(option);
      if (markupPercent == null) {
        return `${index + 1}. **${explained.room}** — ${explained.price}`;
      }
      const suggested = formatRoomMoney(
        clientPriceAtMarkup(option.cost_internal, markupPercent),
        option.currency,
      );
      return `${index + 1}. **${explained.room}** — team cost ${explained.price} · suggest ${suggested}`;
    });
    const suggestion =
      markupPercent == null
        ? null
        : `Minimum markup on file is ${markupPercent}%. The suggested client price is the team cost plus that percent. It is not saved.`;
    return [
      `**${hotel}** · ${from} – ${to} · ${first.nightsLabel} · ${party}`,
      `${rateWord}. Each amount on the card is the team cost.`,
      lines.join("\n"),
      suggestion,
      "Tap **Add for the client** on a room, then send the client price you want. Ask a percent question, such as **10% more on room 1**, and I will calculate it.",
      "Ask me if you want help choosing. Once the client has picked, use **Client chose this** on a saved room.",
    ].filter((line): line is string => Boolean(line)).join("\n\n");
  }

  function localChatMessage(
    role: ChatMessage["role"],
    content: string,
  ): ChatMessage {
    return {
      id: `local-${role}-${crypto.randomUUID()}`,
      role,
      content,
      incomplete: false,
      client_request_id: null,
      created_at: new Date().toISOString(),
    };
  }

  function createdTripReply(saved: TripDetail): ChatMessage {
    const name = saved.client?.display_name?.trim();
    const content = name
      ? `I've created this trip for **${name}**.\n\n${whoElseText(saved)}`
      : "I've created this trip. Tell me which client it is for, and a confirm chip will appear before they are added.";
    return localChatMessage("assistant", content);
  }

  function promptCreateTrip() {
    const names = suggestedClients.map((client) => client.display_name);
    const content =
      names.length > 0
        ? `Pick a client to start this trip:\n${names.map((name) => `- **Create trip · ${name}**`).join("\n")}`
        : "Tell me which client this trip is for. When I find them, tap **Create trip · their name** below.";
    setMessages((prev) => [
      ...prev,
      localChatMessage("user", "Create trip"),
      localChatMessage("assistant", content),
    ]);
  }

  async function searchClientsForMessage(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      setClientHits([]);
      return;
    }
    try {
      const response = await searchClients({ q, limit: 8 });
      setClientHits(response.data.clients);
    } catch (error) {
      showApiError(error);
    }
  }

  function quoteRefreshNote(): string {
    return detail?.quote.document?.status === "ready"
      ? "\n\nThe quote PDF is out of date. Generate it again when the stays are set."
      : "";
  }

  function clearOfferedChips() {
    setPendingLead(null);
    setLeadHits([]);
    setPendingRole(null);
    setRoleHits([]);
    setPendingTraveller(null);
    setClientHits([]);
    setPendingAssign(null);
    setPendingTripDates(null);
    setPendingShift(null);
    setOfferReopen(false);
    setPendingDateDrop(null);
    setPendingLeg(null);
    setPendingRevise(null);
    setPendingRemove(null);
    setPendingStayOverlap(false);
    setPendingStayUpdate(false);
    setPendingRateSearch(false);
    setPendingPaste(null);
    setPendingSell(null);
    setPendingOptionDraft(null);
    setPendingOptionCommit(null);
    setPendingOptionSelect(null);
    setPendingCostUpdate(null);
    setPendingOptionsText(null);
    setPendingPdfEdit(null);
    setConfirmFocus(null);
    setAtlasHotels([]);
  }

  function clearStayPrompts() {
    setPendingLeg(null);
    setPendingRevise(null);
    setPendingRemove(null);
    setPendingDateDrop(null);
    setPendingTripDates(null);
    setPendingShift(null);
    setPendingStayOverlap(false);
    setPendingStayUpdate(false);
    setConfirmFocus((current) =>
      current === "trip-dates" ||
      current === "shift-trip" ||
      current === "date-drop" ||
      current === "remove-stay" ||
      current === "revise-stay" ||
      current === "add-stay" ||
      current === "stay-overlap" ||
      current === "stay-update"
        ? null
        : current,
    );
  }

  async function commitAddLeg(
    draft: { city: string; checkIn: string; checkOut: string; confirmOverlap?: boolean },
    userLine = `Add stay · ${draft.city}`,
  ) {
    if (!canWrite || !detail) return;
    clearStayPrompts();
    setBusy(true);
    try {
      const confirmed = Boolean(detail.trip.legs_confirmed_at);
      const quoteNote = quoteRefreshNote();
      const response = await addTripBuilderLeg(detail.trip.id, {
        city: draft.city,
        check_in: draft.checkIn,
        check_out: draft.checkOut,
        confirm_overlap: draft.confirmOverlap ?? false,
      });
      chooseLeg(response.data.leg_id);
      setDetail(response.data.detail);
      hydrateStayDraft(response.data.detail, response.data.leg_id);
      setRateOptions([]);
      setPendingRateSearch(false);
      const start = response.data.detail.trip.starts_on;
      const end = response.data.detail.trip.ends_on;
      appendTurn(
        userLine,
        confirmed
          ? `**${draft.city}**, ${draft.checkIn} to ${draft.checkOut} is on the trip. Send the hotel and party, then tap **Save stay**.${quoteNote}`
          : `**${draft.city}**, ${draft.checkIn} to ${draft.checkOut} is inside the trip${start && end ? ` (${start} to ${end})` : ""}.\n\nSend the next stay the same way, or tap **Plan these stays** when the list is complete.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitRevise(
    draft: {
      legId: string;
      city: string;
      checkIn: string;
      checkOut: string;
      confirmOverlap?: boolean;
    },
    userLine = `Update ${draft.city}`,
  ) {
    if (!canWrite || !detail) return;
    const hadRate = detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === draft.legId,
    );
    const quoteNote = quoteRefreshNote();
    clearStayPrompts();
    setBusy(true);
    try {
      const saved = await updateTripBuilderLeg(detail.trip.id, draft.legId, {
        city: draft.city,
        check_in: draft.checkIn,
        check_out: draft.checkOut,
        confirm_overlap: draft.confirmOverlap ?? false,
      });
      setDetail(saved.data);
      chooseLeg(draft.legId);
      hydrateStayDraft(saved.data, draft.legId);
      setRateOptions([]);
      appendTurn(
        userLine,
        `**${draft.city}** is now ${draft.checkIn} to ${draft.checkOut}.${
          hadRate ? " The selected rate was cleared. Search rates again for these dates." : ""
        }${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitRemove(target: { legId: string; city: string }, userLine?: string) {
    if (!canWrite || !detail) return;
    const quoteNote = quoteRefreshNote();
    clearStayPrompts();
    setBusy(true);
    try {
      const saved = await removeTripBuilderLeg(detail.trip.id, target.legId);
      setDetail(saved.data);
      const stays = tripStays(saved.data);
      const next = stays[0] ?? null;
      if (next) {
        chooseLeg(next.leg_id);
        hydrateStayDraft(saved.data, next.leg_id);
      } else {
        chooseLeg(null);
        setStayDraft(draftFromStay(null));
      }
      setRateOptions([]);
      appendTurn(
        userLine ?? `Remove ${target.city}`,
        stays.length === 0
          ? `**${target.city}** is removed. That was the only stay. List the stays again, inside **${saved.data.trip.starts_on}** to **${saved.data.trip.ends_on}**.${quoteNote}`
          : `**${target.city}** is removed. Its booking is cancelled. The open stay is **${next?.city}**.${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveTripDates(
    dates: { checkIn: string; checkOut: string },
    dropOutside = false,
  ) {
    if (!canWrite || !detail) return;
    const hadDates = Boolean(detail.trip.starts_on);
    const listed = Boolean(detail.trip.legs_confirmed_at);
    const quoteNote = quoteRefreshNote();
    setPendingTripDates(null);
    setPendingDateDrop(null);
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        starts_on: dates.checkIn,
        ends_on: dates.checkOut,
        drop_outside_legs: dropOutside || undefined,
      });
      const saved = response.data;
      setDetail(saved);
      const stays = tripStays(saved);
      setRateOptions([]);
      const stillOpen = stays.find((stay) => stay.leg_id === activeLegIdRef.current);
      if (!stillOpen) {
        if (stays[0]) {
          chooseLeg(stays[0].leg_id);
          hydrateStayDraft(saved, stays[0].leg_id);
        } else {
          chooseLeg(null);
          setStayDraft(draftFromStay(null));
        }
      }
      const open = stayOn(saved, activeLegIdRef.current);
      const followUp = !hadDates
        ? `Now list each stay inside those dates. For example:\n\nCity: Maldives\nCheck-in: ${dates.checkIn}\nCheck-out: ${dates.checkOut}\n\nA city on its own uses the full trip for the first stay. When the list is complete, tap **Plan these stays**.`
        : dropOutside
          ? "Stays outside that window were removed, and their bookings were cancelled."
          : listed
            ? `Every stay that still fits keeps its own check-in and check-out.${open ? ` The open stay is **${open.city}**.` : ""} The previous rate list is cleared. Change a stay if its nights should move, then search rates again.`
            : "Keep listing stays inside the new dates, then tap **Plan these stays**.";
      appendTurn(
        `Trip dates ${dates.checkIn} to ${dates.checkOut}`,
        `Trip dates are **${dates.checkIn}** to **${dates.checkOut}**.\n\n${followUp}${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitShift(days: number) {
    if (!canWrite || !detail) return;
    const quoteNote = quoteRefreshNote();
    const label = shiftLabel(days);
    clearStayPrompts();
    setBusy(true);
    try {
      const response = await shiftTripBuilderDates(detail.trip.id, { days });
      const saved = response.data;
      setDetail(saved);
      hydrateStayDraft(saved, activeLegIdRef.current);
      setRateOptions([]);
      const lines = tripStays(saved)
        .map((stay) => `- **${stay.city}**: ${stay.check_in} to ${stay.check_out}`)
        .join("\n");
      appendTurn(
        `Shift every stay ${label}`,
        `Moved the trip ${label}: **${saved.trip.starts_on}** to **${saved.trip.ends_on}**.${lines ? `\n\n${lines}` : ""}\n\nHotels stay the same. Selected rates were cleared, so search rates again for the new dates.${quoteNote}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmLegs() {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await updateTripBuilderTrip(detail.trip.id, {
        confirm_legs: true,
      });
      const saved = response.data;
      setDetail(saved);
      const first = tripStays(saved)[0];
      if (first) {
        chooseLeg(first.leg_id);
        hydrateStayDraft(saved, first.leg_id);
      }
      appendTurn(
        "Plan these stays",
        first
          ? stayAskText(
              `The stay list is set. Plan **${first.city}** first (${first.check_in} to ${first.check_out}). You can still add a stay, change one, or change the trip dates later.`,
            )
          : "The stay list is set. Send the hotel for the open stay.",
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(text: string) {
    const message = text.trim();
    if (!message || !canWrite) return;

    if (!detail) {
      await sendHomeChat(message);
      return;
    }

    if (pendingOptionDraft && !confirmFocus && isDeclineReply(message)) {
      setPendingOptionDraft(null);
      void appendTurn(message, "Okay. I won't add that room.");
      return;
    }
    if (pendingOptionDraft && !confirmFocus && isConfirmReply(message)) {
      void appendTurn(
        message,
        `Send the client price for **${pendingOptionDraft.title}**, for example **2400 ${pendingOptionDraft.currency ?? "USD"}**. Say **to be confirmed** to leave it empty.`,
      );
      return;
    }
    if (
      pendingOptionDraft &&
      !isConfirmReply(message) &&
      !isDeclineReply(message) &&
      (isPriceSkip(message) || parseMoneyReply(message))
    ) {
      acceptDraftPrice(message);
      return;
    }

    const stage = resolveTripStage(detail);
    const openStay = stayOn(detail, activeLegIdRef.current);
    if (!isConfirmReply(message) && !isDeclineReply(message)) {
      const holdDraft =
        pendingOptionDraft && confirmFocus !== "add-option" && isTripQuestion(message)
          ? pendingOptionDraft
          : null;
      clearOfferedChips();
      if (holdDraft) setPendingOptionDraft(holdDraft);
      const writing =
        wantsRateSearch(message) ||
        Boolean(parseSellMessage(message)) ||
        Boolean(parseQuoteEdit(message)) ||
        Boolean(parseOptionsWording(message)) ||
        looksLikeOptionsPdfEdit(message) ||
        wantsOptionsPreview(message) ||
        isSupplierPaste(message) ||
        parseTripShift(message) != null;
      setQuietChips(isTripQuestion(message) && !writing && !holdDraft);
    } else {
      setQuietChips(false);
    }

    const windowStart = detail.trip.starts_on;
    const windowEnd = detail.trip.ends_on;
    const collectingDates = !windowStart || !windowEnd;
    const collectingLegs = Boolean(windowStart && windowEnd && !detail.trip.legs_confirmed_at);
    const stays = tripStays(detail);

    function insideWindow(checkIn: string, checkOut: string) {
      return Boolean(
        windowStart &&
          windowEnd &&
          checkIn >= windowStart &&
          checkOut <= windowEnd &&
          checkOut > checkIn,
      );
    }

    function offerDates(dates: { checkIn: string; checkOut: string }, userLine: string) {
      const outside = staysOutsideWindow(stays, dates.checkIn, dates.checkOut);
      clearStayPrompts();
      if (outside.length > 0) {
        setPendingDateDrop(dates);
        setConfirmFocus("date-drop");
        const names = outside
          .map((stay) => `**${stay.city}** (${stay.check_in} to ${stay.check_out})`)
          .join(", ");
        void appendTurn(
          userLine,
          `${names} sit outside **${dates.checkIn}** to **${dates.checkOut}**. Change those stays so they fit, or tap **Remove outside stays and save dates**. Say **no** to keep the current trip dates.`,
        );
        return;
      }
      setPendingTripDates(dates);
      setConfirmFocus("trip-dates");
      void appendTurn(
        userLine,
        `Save the trip as **${dates.checkIn}** to **${dates.checkOut}**?\n\nStays keep their own check-in and check-out when they still fit. The rate list clears. Say **yes** or tap **Save trip dates**. Say **no** to cancel.`,
      );
    }

    if (confirmFocus && (isDeclineReply(message) || isConfirmReply(message))) {
      const focus = confirmFocus;
      const confirming = isConfirmReply(message);
      setConfirmFocus(null);
      if (!confirming) {
        if (focus === "trip-dates" || focus === "date-drop" || focus === "shift-trip") {
          setPendingTripDates(null);
          setPendingDateDrop(null);
          setPendingShift(null);
          void appendTurn(message, "Okay. The trip dates stay as they are.");
          return;
        }
        if (focus === "remove-stay") {
          setPendingRemove(null);
          void appendTurn(message, "Okay. I won't remove that stay.");
          return;
        }
        if (focus === "revise-stay") {
          setPendingRevise(null);
          void appendTurn(message, "Okay. That stay stays as it is.");
          return;
        }
        if (focus === "add-stay") {
          setPendingLeg(null);
          void appendTurn(message, "Okay. I won't add that stay.");
          return;
        }
        if (focus === "stay-overlap") {
          setPendingStayOverlap(false);
          void appendTurn(message, "Okay. I won't save those overlapping nights.");
          return;
        }
        if (focus === "stay-update") {
          setPendingStayUpdate(false);
          void appendTurn(message, "Okay. That stay stays as it is.");
          return;
        }
        if (focus === "lead") {
          setPendingLead(null);
          void appendTurn(message, "Okay. The lead stays as it is.");
          return;
        }
        if (focus === "traveller") {
          setPendingTraveller(null);
          void appendTurn(message, "Okay. Name someone else, or say **just them**.");
          return;
        }
        if (focus === "role") {
          setPendingRole(null);
          void appendTurn(message, "Okay. That traveller stays as they are.");
          return;
        }
        if (focus === "assign") {
          setPendingAssign(null);
          void appendTurn(message, "Okay. I won't add that client.");
          return;
        }
        if (focus === "paste") {
          setPendingPaste(null);
          void appendTurn(message, "Okay. I won't use that quote.");
          return;
        }
        if (focus === "sell") {
          setPendingSell(null);
          void appendTurn(message, "Okay. I won't change the client price.");
          return;
        }
        if (focus === "add-option") {
          setPendingOptionCommit(null);
          setPendingOptionDraft(null);
          void appendTurn(message, "Okay. I won't save that room.");
          return;
        }
        if (focus === "select-room") {
          setPendingOptionSelect(null);
          void appendTurn(message, "Okay. That room stays unselected.");
          return;
        }
        if (focus === "options-text") {
          setPendingOptionsText(null);
          void appendTurn(message, "Okay. I won't change that wording.");
          return;
        }
        if (focus === "options-edit") {
          setPendingPdfEdit(null);
          void appendTurn(message, "Okay. The options quote stays as it is.");
          return;
        }
        if (focus === "options-preview") {
          void appendTurn(message, "Okay. I won't open the options quote.");
          return;
        }
        setPendingRateSearch(false);
        void appendTurn(
          message,
          "Okay. I won't search. Ask again when you want prices, or paste a supplier quote.",
        );
        return;
      }
      if (focus === "trip-dates" && pendingTripDates) {
        void saveTripDates(pendingTripDates);
        return;
      }
      if (focus === "shift-trip" && pendingShift) {
        void commitShift(pendingShift);
        return;
      }
      if (focus === "date-drop" && pendingDateDrop) {
        void saveTripDates(pendingDateDrop, true);
        return;
      }
      if (focus === "remove-stay" && pendingRemove) {
        void commitRemove(pendingRemove, message);
        return;
      }
      if (focus === "revise-stay" && pendingRevise) {
        void commitRevise(pendingRevise, message);
        return;
      }
      if (focus === "add-stay" && pendingLeg) {
        void commitAddLeg(pendingLeg, message);
        return;
      }
      if (focus === "stay-overlap") {
        void saveStayFromDraft(true);
        return;
      }
      if (focus === "stay-update") {
        setPendingStayUpdate(false);
        void saveStayFromDraft();
        return;
      }
      if (focus === "lead" && pendingLead && !detail.pricing_locked) {
        void changeLead(pendingLead, message);
        return;
      }
      if (focus === "traveller" && pendingTraveller && !detail.pricing_locked) {
        void addTraveller(pendingTraveller, message);
        return;
      }
      if (focus === "role" && pendingRole && !detail.pricing_locked) {
        void setPartyRole(pendingRole, message);
        return;
      }
      if (focus === "rate-search") {
        void searchRates(stayDraft, message);
        return;
      }
      if (focus === "assign" && pendingAssign) {
        void assignClient(pendingAssign.id);
        return;
      }
      if (focus === "paste" && pendingPaste) {
        void pasteQuote(pendingPaste);
        return;
      }
      if (focus === "sell" && pendingSell) {
        void applySell();
        return;
      }
      if (focus === "add-option" && pendingOptionCommit) {
        void commitOption(pendingOptionCommit, message);
        return;
      }
      if (focus === "select-room" && pendingOptionSelect) {
        void commitSelect(pendingOptionSelect, message);
        return;
      }
      if (focus === "options-text" && pendingOptionsText) {
        void commitOptionsText(pendingOptionsText, message);
        return;
      }
      if (focus === "options-edit" && pendingPdfEdit && pendingPdfEdit.length > 0) {
        void commitPdfEdits(pendingPdfEdit, message);
        return;
      }
      if (focus === "options-preview") {
        void openOptionsQuote(message);
        return;
      }
    }

    const stayEdit =
      Boolean(parseAddStay(message)) ||
      Boolean(parseListedStayEdit(message, stays)) ||
      Boolean(parseRemoveStay(message)) ||
      Boolean(parseCityOnly(message)) ||
      wantsChangeTripDates(message) ||
      wantsAddStay(message) ||
      parseTripShift(message) != null;
    if (detail.pricing_locked && stayEdit) {
      setOfferReopen(true);
      void appendTurn(
        message,
        `Pricing is locked on this trip. To change dates or stays, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and choose **Reopen quote** under Update status.`,
      );
      return;
    }

    const shift = windowStart && windowEnd ? parseTripShift(message) : null;
    if (shift) {
      clearStayPrompts();
      setPendingShift(shift);
      setConfirmFocus("shift-trip");
      void appendTurn(
        message,
        `Move the whole trip and every stay **${shiftLabel(shift)}**? Hotels stay the same. Selected rates clear and pending bookings are cancelled, because prices depend on dates.\n\nSay **yes** or tap **Shift every stay**. Say **no** to cancel.`,
      );
      return;
    }

    if (collectingDates) {
      if (parseAddStay(message) || wantsAddStay(message) || parseCityOnly(message)) {
        void appendTurn(
          message,
          "Set the trip start and end first. Every stay has to sit inside those days.\n\nStart: 2026-10-10\nEnd: 2026-10-20",
        );
        return;
      }
      const dates = parseTripDates(message);
      if (dates) {
        offerDates(dates, message);
        return;
      }
    }

    if (windowStart && windowEnd && !looksLikeHotelPlan(message)) {
      const removal = parseRemoveStay(message);
      if (removal) {
        const target =
          removal === "open"
            ? openStay
            : stays.find(
                (stay) => stay.city.trim().toLowerCase() === removal.toLowerCase(),
              );
        if (!target) {
          if (removal === "open" || /\b(?:stay|leg)\b/i.test(message)) {
            void appendTurn(
              message,
              "Name the city to remove, or say **remove this stay** while that stay is open.",
            );
            return;
          }
        } else {
          clearStayPrompts();
          setPendingRemove({ legId: target.leg_id, city: target.city });
          setConfirmFocus("remove-stay");
          void appendTurn(
            message,
            `Remove **${target.city}**${target.check_in ? ` (${target.check_in} to ${target.check_out})` : ""}? Its booking will be cancelled. Say **yes** or tap **Remove ${target.city}**. Say **no** to cancel.`,
          );
          return;
        }
      }

      const listedEdit = parseListedStayEdit(message, stays);
      const added = parseAddStay(message);
      const sameCity =
        added &&
        stays.some((stay) => stay.city.trim().toLowerCase() === added.city.toLowerCase()) &&
        !/^\s*(?:add|another|new|extra)\b/i.test(message);
      const reviseDraft = listedEdit ?? (sameCity ? added : null);
      if (reviseDraft) {
        const existing = stays.find(
          (stay) => stay.city.trim().toLowerCase() === reviseDraft.city.toLowerCase(),
        );
        if (existing) {
          if (!insideWindow(reviseDraft.checkIn, reviseDraft.checkOut)) {
            void appendTurn(
              message,
              `**${reviseDraft.city}** ${reviseDraft.checkIn} to ${reviseDraft.checkOut} sits outside the trip (**${windowStart}** to **${windowEnd}**). Widen the trip dates first, or pick dates inside them.`,
            );
            return;
          }
          const clash = findOverlappingStay(
            stays,
            reviseDraft.checkIn,
            reviseDraft.checkOut,
            existing.leg_id,
          );
          clearStayPrompts();
          setPendingRevise({
            legId: existing.leg_id,
            city: existing.city,
            checkIn: reviseDraft.checkIn,
            checkOut: reviseDraft.checkOut,
            confirmOverlap: Boolean(clash),
          });
          setConfirmFocus("revise-stay");
          void appendTurn(
            message,
            clash
              ? `**${existing.city}** ${reviseDraft.checkIn} to ${reviseDraft.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to update anyway, or **no** to cancel.`
              : `Update **${existing.city}** to ${reviseDraft.checkIn}–${reviseDraft.checkOut}? Say **yes** or tap **Update ${existing.city}**. Say **no** to cancel.`,
          );
          return;
        }
      }

      if (added) {
        if (!insideWindow(added.checkIn, added.checkOut)) {
          void appendTurn(
            message,
            `**${added.city}** ${added.checkIn} to ${added.checkOut} sits outside the trip (**${windowStart}** to **${windowEnd}**). Send dates inside that window.`,
          );
          return;
        }
        const clash = findOverlappingStay(stays, added.checkIn, added.checkOut, null);
        clearStayPrompts();
        setPendingLeg({
          city: added.city,
          checkIn: added.checkIn,
          checkOut: added.checkOut,
          confirmOverlap: Boolean(clash),
        });
        setConfirmFocus("add-stay");
        void appendTurn(
          message,
          clash
            ? `**${added.city}** ${added.checkIn} to ${added.checkOut} overlaps **${clash.city}** (${clash.check_in} to ${clash.check_out}). Say **yes** to add it anyway, or **no** to cancel.`
            : `Add **${added.city}**, ${added.checkIn} to ${added.checkOut}?\n\nSay **yes** to add it. Say **no** to cancel.`,
        );
        return;
      }

      const namedStayEdit = Boolean(parseListedStayEdit(message, stays) || parseAddStay(message));
      const labeledTripDates =
        /(?:^|\n)\s*(?:trip\s+)?(?:start|end)(?:\s+date)?\s*[:\-]\s*\d{4}-\d{2}-\d{2}/i.test(
          message,
        );
      if (!namedStayEdit && (wantsChangeTripDates(message) || labeledTripDates)) {
        const dates = parseTripDates(message);
        if (!dates) {
          void appendTurn(
            message,
            `Send the new trip dates as **Start: ${windowStart}** and **End: ${windowEnd}**. Stays that no longer fit will be named before anything is saved. The rate list clears after the dates change.`,
          );
          return;
        }
        offerDates(dates, message);
        return;
      }

      if (wantsAddStay(message)) {
        void appendTurn(
          message,
          `Send a city and both dates inside **${windowStart}** to **${windowEnd}**. For example **City: Maldives**, **Check-in: ${windowStart}**, **Check-out: ${windowEnd}**.`,
        );
        return;
      }

      if (collectingLegs && stays.length === 0) {
        const city = parseCityOnly(message);
        if (city) {
          clearStayPrompts();
          setPendingLeg({
            city,
            checkIn: windowStart,
            checkOut: windowEnd,
            confirmOverlap: false,
          });
          setConfirmFocus("add-stay");
          void appendTurn(
            message,
            `Add **${city}** for the whole trip, ${windowStart} to ${windowEnd}?\n\nSay **yes** to add it. Say **no** to cancel.`,
          );
          return;
        }
      }
    }

    if (
      openStay &&
      windowStart &&
      windowEnd &&
      legsConfirmed(detail) &&
      !detail.pricing_locked &&
      !wantsChangeTripDates(message) &&
      !wantsRateSearch(message)
    ) {
      const patch = parseStayMessage(message);
      const editingStay = Boolean(
        patch.hotel ||
          patch.city ||
          patch.checkIn ||
          patch.checkOut ||
          patch.rooms != null,
      );
      const askedToEdit =
        looksLikeHotelPlan(message) ||
        (/\b(?:change|update|move|set|correct)\b/i.test(message) &&
          /\b(?:hotel|property|check[\s-]?in|check[\s-]?out|rooms?|city)\b/i.test(message));
      if (editingStay && askedToEdit) {
        const merged = mergeStayDraft(stayDraft, patch);
        const next = {
          ...merged,
          hotel: merged.hotel || openStay.property_name || "",
          city: merged.city || openStay.city,
          checkIn: merged.checkIn || openStay.check_in || "",
          checkOut: merged.checkOut || openStay.check_out || "",
        };
        setStayDraft(withPartyCounts(next, detail));
        if (!stayDraftReady(withPartyCounts(next, detail))) {
          void appendTurn(
            message,
            `I can update **${openStay.city}**. Send the missing piece, for example **Rooms: 1** or **Hotel:** with the name, then tap **Update stay**.`,
          );
          return;
        }
        setPendingStayUpdate(true);
        setConfirmFocus("stay-update");
        void appendTurn(
          message,
          `Update **${next.city}** to **${next.hotel}**, ${next.checkIn} to ${next.checkOut}? The selected rate for this stay will clear. Say **yes** or tap **Update stay**. Say **no** to cancel.`,
        );
        return;
      }
    }

    if (detail.client) {
      const leadChange = parseLeadChange(message);
      if (leadChange) {
        if (detail.pricing_locked) {
          void appendTurn(message, "Pricing is locked, so the lead stays as it is.");
          return;
        }
        if (leadChange.name.trim().length < 2) {
          void appendTurn(
            message,
            "Who should be the lead? For example: **Make Ravi Mehta the lead**.",
          );
          return;
        }
        void offerLead(leadChange.name, message);
        return;
      }
    }

    if (detail.client && detail.pricing_locked) {
      const lockedParty = parseTravellerCommand(message);
      if (
        lockedParty &&
        (lockedParty.kind === "role" ||
          lockedParty.kind === "add" ||
          lockedParty.kind === "remove")
      ) {
        void appendTurn(message, "Pricing is locked, so the traveller list stays as it is.");
        return;
      }
    }

    if (detail.client && !detail.pricing_locked) {
      const command = parseTravellerCommand(message);
      const partyOpen = !travellersConfirmed(detail);
      if (partyOpen && stage === "client" && command?.kind === "confirm") {
        void confirmTravellers(message);
        return;
      }
      if (command?.kind === "role" && (partyOpen || travellersConfirmed(detail))) {
        void offerRole(command.name, command.role, message);
        return;
      }
      if (command?.kind === "remove" && (partyOpen || travellersConfirmed(detail))) {
        const match = detail.travellers.find(
          (person) => person.display_name.trim().toLowerCase() === command.name.toLowerCase(),
        );
        if (!match) {
          void appendTurn(message, `**${command.name}** is not on this trip.`);
          return;
        }
        void removeTraveller(match.client_id, match.display_name, message);
        return;
      }
      if (
        command?.kind === "add" &&
        (partyOpen || travellersConfirmed(detail))
      ) {
        void offerTraveller(command.name, command.child, message);
        return;
      }
    }

    if (
      travellersConfirmed(detail) &&
      !detail.pricing_locked &&
      !looksLikeHotelPlan(message)
    ) {
      const picked = stage === "stay" ? matchAtlasPick(message, atlasHotels) : null;
      if (picked) {
        void useAtlasHotel(picked, message);
        return;
      }
      const choosingRooms =
        isRateStage(stage) &&
        questionUsesRatePack(message) &&
        (rateOptions.length > 0 ||
          detail.rates.candidates.some((row) => !row.selected));
      if (
        !choosingRooms &&
        (isPlaceQuestion(message) || wantsHotelSearch(message) || mightNamePlace(message))
      ) {
        const remembered = atlasPlaceRef.current;
        const hint = remembered?.city || remembered?.country || openStay?.city || null;
        const answered = await askAtlas(message, hint);
        if (answered) return;
      }
    }

    const rateStage = isRateStage(stage);
    const asking = isTripQuestion(message) && !wantsOptionsPreview(message);
    const optionPrice = parseOptionClientPrice(message);
    if (rateStage && wantsOptionsPreview(message)) {
      offerOptionsPreview(message);
      return;
    }
    if (optionPrice && !asking && !detail.pricing_locked && rateStage) {
      const choices = listedRates(
        rateOptions,
        detail.rates.candidates,
        activeLegIdRef.current,
      );
      const query = optionPrice.room ? `add ${optionPrice.room}` : "";
      const picked = query
        ? matchRateChoice(query, choices)
        : choices.length === 1
          ? choices[0]
          : choices.length > 1
            ? "ambiguous"
            : null;
      if (picked === "ambiguous" || !picked) {
        const list = choices.map((choice) => `**${choice.title}**`).join(", ");
        void appendTurn(
          message,
          list
            ? `Which room? ${list}. For example: **client price ${optionPrice.amount} ${optionPrice.currency ?? "USD"} for ${choices[0]?.title ?? "the room name"}**.`
            : "Add a room first. Say **add** and the room name.",
        );
        return;
      }
      offerAddRoom(picked, { amount: optionPrice.amount, currency: optionPrice.currency }, message);
      return;
    }
    if (rateStage) {
      const mathReply = answerPriceQuestion(
        message,
        roomsForPriceMath(),
        markupPercentFromNotes(rateStayNotes?.markup ?? null),
        {
          amount: detail.trip.sell_total,
          currency: detail.trip.sell_currency,
          teamCost: buildQuoteBreakup({
            stays,
            rates: detail.rates.candidates,
            sellTotal: detail.trip.sell_total,
            sellCurrency: detail.trip.sell_currency,
          }).teamCostAmount,
        },
        pendingOptionDraft?.title ?? null,
      );
      if (mathReply) {
        void appendTurn(message, mathReply);
        return;
      }
    }

    const sellRequest = parseSellMessage(message);
    const quoteRequest = parseQuoteEdit(message);
    const openHasRate = detail.rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === (openStay?.leg_id ?? null),
    );
    if (rateStage && detail.pricing_locked && !asking) {
      const lockedPick =
        !wantsRateSearch(message) && !isSupplierPaste(message) && !sellRequest && !quoteRequest
          ? matchRateChoice(
              splitTrailingPrice(message).text,
              listedRates([], detail.rates.candidates, activeLegIdRef.current),
            )
          : null;
      if (
        lockedPick &&
        lockedPick !== "ambiguous" &&
        lockedPick.kind === "saved" &&
        !lockedPick.row.selected &&
        lockedPick.row.sell_amount != null &&
        !isOptionsAdd(message)
      ) {
        offerSelectRoom(lockedPick, message);
        return;
      }
      if (
        !wantsRateSearch(message) &&
        (isSupplierPaste(message) ||
          sellRequest ||
          quoteRequest ||
          matchRateChoice(
            message,
            listedRates(rateOptions, detail.rates.candidates, activeLegIdRef.current),
          ))
      ) {
        void appendTurn(
          message,
          "The client accepted this quote, so new rooms, the trip total, and the quote wording stay as they are. You can still tap **Check availability** for today's price, or **Set client price** on the client's chosen room. To change anything else, reopen the quote on the trip page.",
        );
        return;
      }
    }

    if (
      rateStage &&
      !detail.pricing_locked &&
      !asking &&
      !isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest
    ) {
      const priced = splitTrailingPrice(message);
      const choices = listedRates(
        rateOptions,
        detail.rates.candidates,
        activeLegIdRef.current,
      );
      const picked = matchRateChoice(priced.text, choices);
      if (picked === "ambiguous") {
        void appendTurn(
          message,
          "More than one rate matches that. Type **add 1** or **client chose 1**, or the full room name.",
        );
        return;
      }
      if (picked) {
        if (isOptionsAdd(priced.text)) offerAddRoom(picked, priced.price, message);
        else offerSelectRoom(picked, message);
        return;
      }
    }

    if (stage === "client" && !detail.client) {
      if (pendingAssign && isConfirmReply(message)) {
        // Keep the confirm chip.
      } else if (wantsAssignClient(message)) {
        setPendingAssign(null);
        const name = clientNameFromMessage(message);
        if (name) void searchClientsForMessage(name);
        else setClientHits([]);
      } else {
        setClientHits([]);
        setPendingAssign(null);
      }
    }
    let searchDraft = stayDraft;
    if ((stage === "stay" || stage === "rates") && legsConfirmed(detail)) {
      searchDraft = mergeStayDraft(
        stayDraft,
        parseStayMessage(message, { partyOnly: stage === "rates" }),
      );
      setStayDraft(searchDraft);
    }
    if (
      rateStage &&
      !asking &&
      !isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest &&
      wantsRateSearch(message)
    ) {
      const named = travellersConfirmed(detail) ? partyFromTravellers(detail) : null;
      const draft = searchDraft;
      const ready =
        openStay &&
        draft.rooms != null &&
        ((named && named.adults >= 1) || partyReady(draft));
      if (!ready) {
        void appendTurn(
          message,
          named && named.adults >= 1
            ? "I still need the rooms before I search. For example **Rooms: 1**."
            : "I still need adults, children, and rooms before I search. For example **Adults: 2**, **Children: 0**, **Rooms: 1**.",
        );
        return;
      }
      clearStayPrompts();
      setPendingRateSearch(true);
      setConfirmFocus("rate-search");
      const rooms = draft.rooms === 1 ? "1 room" : `${draft.rooms} rooms`;
      void appendTurn(
        message,
        `Search **${openStay.property_name ?? draft.hotel}** in **${openStay.city}**, ${openStay.check_in} to ${openStay.check_out}, ${draft.adults} adults, ${draft.children} children, ${rooms}?\n\nSay **yes** or tap **Search rates**. Say **no** to cancel.`,
      );
      return;
    }
    if (
      rateStage &&
      !detail.pricing_locked &&
      isSupplierPaste(message) &&
      !sellRequest &&
      !quoteRequest
    ) {
      if (!openStay?.check_in || !openStay.check_out) {
        void appendTurn(message, "Save the stay dates first, then paste the supplier total.");
        return;
      }
      setPendingPaste(message);
      setConfirmFocus("paste");
      setQuietChips(false);
      void appendTurn(
        message,
        "Use this pasted quote as the team cost for this stay? Say **yes** or tap **Use pasted quote**. Say **no** to cancel.",
      );
      return;
    }
    const optionsRows = detail.rates.candidates.some((row) => !row.selected);
    const optionsWording =
      parseOptionsWording(message) ??
      (optionsRows &&
      !openHasRate &&
      quoteRequest &&
      (quoteRequest.field === "title" || quoteRequest.field === "notes")
        ? { field: quoteRequest.field, value: quoteRequest.value }
        : null);
    if (optionsWording && rateStage && !asking) {
      const canEditOptions =
        optionsRows ||
        detail.rates.candidates.some((row) => row.selected) ||
        Boolean(detail.options_quote.document?.has_file);
      if (!canEditOptions) {
        void appendTurn(message, "Add a room to the options quote first. Then set the note or the title.");
        return;
      }
      offerOptionsText(optionsWording, message);
      return;
    }
    if (quoteRequest && optionsRows && rateStage && !asking) {
      void appendTurn(
        message,
        "That line is on the options quote. Say **note:** or **options title:**, or say which words to change.",
      );
      return;
    }
    if (sellRequest && (stage === "quote" || stage === "booking" || (stage === "rates" && openHasRate)) && !asking) {
      setPendingSell(sellRequest);
      setConfirmFocus("sell");
      setQuietChips(false);
      void appendTurn(
        message,
        `Set the client price to **${sellRequest.sell_currency} ${sellRequest.sell_total}**? Say **yes** or tap **Set sell ${sellRequest.sell_currency} ${sellRequest.sell_total}**. Say **no** to cancel.`,
      );
      return;
    }
    if (stage === "rates" && !asking && (sellRequest || quoteRequest)) {
      void appendTurn(
        message,
        optionsRows
          ? "For the options PDF, say **note:** or **options title:**, or say which words to change."
          : "Add a room to the options quote first. Then set the note or the title.",
      );
      return;
    }
    if (
      rateStage &&
      looksLikeOptionsPdfEdit(message) &&
      (optionsRows ||
        detail.rates.candidates.some((row) => row.selected) ||
        Boolean(detail.options_quote.document?.has_file))
    ) {
      const offered = await offerPdfEdit(message);
      if (offered) return;
    }

    await sendTripChat(message);
  }

  const stage = resolveTripStage(detail);
  const openStay = stayOn(detail, activeLegId);
  const chips: TripBuilderChip[] = [];

  if (!detail && canWrite) {
    chips.push({
      id: "create-trip",
      label: "Create trip",
      variant: "primary",
      icon: "plus",
      onClick: promptCreateTrip,
    });

    for (const client of suggestedClients) {
      chips.push({
        id: `draft-client-${client.id}`,
        label: `Create trip · ${client.display_name}`,
        variant: "secondary",
        onClick: () => void createTrip(client.id, client.display_name),
      });
    }
  }

  const homeChips: TripBuilderChip[] = [];

  const hasConfirm = Boolean(
    pendingLead ||
      leadHits.length > 0 ||
      pendingRole ||
      roleHits.length > 0 ||
      pendingTraveller ||
      pendingAssign ||
      clientHits.length > 0 ||
      pendingTripDates ||
      pendingShift ||
      offerReopen ||
      pendingDateDrop ||
      pendingLeg ||
      pendingRevise ||
      pendingRemove ||
      pendingStayOverlap ||
      pendingStayUpdate ||
      pendingRateSearch ||
      pendingPaste ||
      pendingSell ||
      pendingOptionDraft ||
      pendingOptionCommit ||
      pendingOptionSelect ||
      pendingOptionsText ||
      pendingPdfEdit ||
      confirmFocus === "options-preview" ||
      atlasHotels.length > 0,
  );
  const hideReady = quietChips || hasConfirm;

  if (detail && canWrite && pendingLead && !detail.pricing_locked) {
    chips.push({
      id: `make-lead-${pendingLead.id}`,
      label: `Make ${pendingLead.display_name} the lead`,
      variant: "primary",
      onClick: () => void changeLead(pendingLead, `Make ${pendingLead.display_name} the lead`),
    });
  }

  if (detail && canWrite && !pendingLead && leadHits.length > 0 && !detail.pricing_locked) {
    for (const [index, hit] of leadHits.slice(0, 6).entries()) {
      chips.push({
        id: `lead-hit-${hit.id}`,
        label: `Make ${hit.display_name} the lead`,
        variant: index === 0 ? "primary" : "secondary",
        onClick: () => void changeLead(hit, `Make ${hit.display_name} the lead`),
      });
    }
  }

  if (detail && canWrite && pendingRole && !detail.pricing_locked) {
    const kind = pendingRole.party_role === "child" ? "a child" : "an adult";
    chips.push({
      id: `set-role-${pendingRole.id}`,
      label: `Make ${pendingRole.display_name} ${kind}`,
      variant: "primary",
      onClick: () =>
        void setPartyRole(
          pendingRole,
          `Make ${pendingRole.display_name} ${kind}`,
        ),
    });
  }

  if (detail && canWrite && !pendingRole && roleHits.length > 0 && !detail.pricing_locked) {
    for (const [index, person] of roleHits.slice(0, 6).entries()) {
      const kind = person.party_role === "child" ? "a child" : "an adult";
      chips.push({
        id: `role-hit-${person.id}`,
        label: `Make ${person.display_name} ${kind}`,
        variant: index === 0 ? "primary" : "secondary",
        onClick: () =>
          void setPartyRole(person, `Make ${person.display_name} ${kind}`),
      });
    }
  }

  if (detail && canWrite && pendingTraveller && !detail.pricing_locked) {
    const child = pendingTraveller.party_role === "child";
    chips.push({
      id: `add-traveller-${pendingTraveller.id}`,
      label: child
        ? `Add ${pendingTraveller.display_name} as a child`
        : `Add ${pendingTraveller.display_name}`,
      variant: "primary",
      onClick: () =>
        void addTraveller(
          pendingTraveller,
          child
            ? `Add ${pendingTraveller.display_name} as a child`
            : `Add ${pendingTraveller.display_name}`,
        ),
    });
  }

  if (
    detail &&
    canWrite &&
    !hideReady &&
    stage === "client" &&
    detail.client &&
    !travellersConfirmed(detail)
  ) {
    if (!pendingTraveller) {
      for (const [index, person] of detail.family_suggestions.slice(0, 6).entries()) {
        chips.push({
          id: `family-${person.client_id}`,
          label: `Add ${person.display_name}`,
          variant: index === 0 ? "primary" : "secondary",
          onClick: () =>
            void addTraveller(
              {
                id: person.client_id,
                display_name: person.display_name,
                party_role: person.party_role,
              },
              `Add ${person.display_name}`,
            ),
        });
      }
      const travellersLabel =
        detail.travellers.length > 1
          ? "Travellers are set"
          : `Only ${detail.client.display_name} is travelling`;
      chips.push({
        id: "travellers-set",
        label: travellersLabel,
        variant: detail.family_suggestions.length === 0 ? "primary" : "secondary",
        onClick: () => void confirmTravellers(travellersLabel),
      });
    }
    const clientName = detail.client.display_name;
    chips.push({
      id: "past-trips",
      label: `Past trips for ${clientName}`,
      variant: "secondary",
      onClick: () => void sendTripChat(`Show past trips and bookings for ${clientName}.`),
    });
  }

  if (
    detail &&
    canWrite &&
    detail.client &&
    !detail.pricing_locked &&
    !pendingTraveller &&
    !pendingLead &&
    clientHits.length > 0
  ) {
    for (const hit of clientHits.slice(0, 6)) {
      if (detail.travellers.some((person) => person.client_id === hit.id)) continue;
      chips.push({
        id: `companion-${hit.id}`,
        label: `Add ${hit.display_name}`,
        variant: "secondary",
        onClick: () =>
          void addTraveller(
            { id: hit.id, display_name: hit.display_name, party_role: "adult" },
            `Add ${hit.display_name}`,
          ),
      });
    }
  }

  if (detail && canWrite && stage === "client" && !detail.client) {
    if (pendingAssign) {
      chips.push({
        id: `confirm-client-${pendingAssign.id}`,
        label: `Add ${pendingAssign.display_name} as the client`,
        variant: "primary",
        onClick: () => void assignClient(pendingAssign.id),
      });
    } else {
      for (const hit of clientHits.slice(0, 6)) {
        chips.push({
          id: `client-${hit.id}`,
          label: `Choose ${hit.display_name}`,
          variant: "secondary",
          onClick: () => {
            setPendingAssign(hit);
            setClientHits([]);
            setConfirmFocus("assign");
          },
        });
      }
    }
  }

  if (detail && canWrite && pendingTripDates && !detail.pricing_locked) {
    const dates = pendingTripDates;
    chips.push({
      id: "save-trip-dates",
      label: `Save trip dates · ${stayRangeLabel(dates.checkIn, dates.checkOut)}`,
      variant: "primary",
      onClick: () => void saveTripDates(dates),
    });
  }

  if (detail && canWrite && pendingShift && !detail.pricing_locked) {
    const days = pendingShift;
    const { starts_on: start, ends_on: end } = detail.trip;
    chips.push({
      id: "shift-trip",
      label:
        start && end
          ? `Shift every stay · ${stayRangeLabel(shiftIsoDate(start, days), shiftIsoDate(end, days))}`
          : `Shift every stay · ${shiftLabel(days)}`,
      variant: "danger",
      onClick: () => void commitShift(days),
    });
  }

  if (detail && canWrite && offerReopen && detail.pricing_locked) {
    chips.push({
      id: "reopen-quote",
      label: "Reopen quote on trip page",
      variant: "primary",
      onClick: openTripPage,
    });
  }

  if (detail && canWrite && pendingDateDrop && !detail.pricing_locked) {
    const dates = pendingDateDrop;
    chips.push({
      id: "drop-outside-stays",
      label: "Remove outside stays and save dates",
      variant: "danger",
      onClick: () => void saveTripDates(dates, true),
    });
  }

  if (detail && canWrite && pendingLeg && !detail.pricing_locked) {
    const draft = pendingLeg;
    chips.push({
      id: "confirm-add-stay",
      label: draft.confirmOverlap
        ? `Add ${draft.city} anyway`
        : `Add ${draft.city} · ${stayRangeLabel(draft.checkIn, draft.checkOut)}`,
      variant: "primary",
      onClick: () => void commitAddLeg(draft),
    });
  }

  if (detail && canWrite && pendingRevise && !detail.pricing_locked) {
    const draft = pendingRevise;
    chips.push({
      id: "confirm-revise-stay",
      label: draft.confirmOverlap ? `Update ${draft.city} anyway` : `Update ${draft.city}`,
      variant: "primary",
      onClick: () => void commitRevise(draft),
    });
  }

  if (detail && canWrite && pendingRemove && !detail.pricing_locked) {
    const target = pendingRemove;
    chips.push({
      id: "confirm-remove-stay",
      label: `Remove ${target.city}`,
      variant: "danger",
      onClick: () => void commitRemove(target),
    });
  }

  if (detail && canWrite && pendingStayOverlap && !detail.pricing_locked) {
    chips.push({
      id: "save-stay-overlap",
      label: "Save stay anyway",
      variant: "primary",
      onClick: () => void saveStayFromDraft(true),
    });
  }

  if (
    detail &&
    canWrite &&
    !detail.pricing_locked &&
    !hideReady &&
    detail.trip.starts_on &&
    !legsConfirmed(detail) &&
    tripStays(detail).length > 0 &&
    !pendingLeg
  ) {
    chips.push({
      id: "plan-stays",
      label: "Plan these stays",
      variant: "primary",
      onClick: () => void confirmLegs(),
    });
  }

  if (
    detail &&
    canWrite &&
    travellersConfirmed(detail) &&
    !detail.pricing_locked &&
    !pendingStayOverlap &&
    atlasHotels.length > 0
  ) {
    const openCity = stayOn(detail, activeLegId)?.city.trim().toLowerCase() ?? "";
    for (const [index, hotel] of atlasHotels.slice(0, 6).entries()) {
      const hotelCity = hotel.city.trim().toLowerCase();
      const samePlace =
        !openCity ||
        !hotelCity ||
        openCity === hotelCity ||
        openCity.includes(hotelCity) ||
        hotelCity.includes(openCity);
      if (!samePlace) continue;
      chips.push({
        id: `atlas-hotel-${hotel.id}`,
        label: `Use ${hotel.name}`,
        variant: index === 0 ? "primary" : "secondary",
        onClick: () => void useAtlasHotel(hotel, `Use ${hotel.name}`),
      });
    }
  }

  if (detail && canWrite && !hideReady && stage === "stay" && legsConfirmed(detail) && !pendingStayOverlap) {
    if (stayDraftReady(stayDraft) && !detail.pricing_locked) {
      chips.push({
        id: "save-stay",
        label: `Save stay · ${stayDraft.hotel} · ${stayDraft.city}`,
        variant: "primary",
        onClick: () => void saveStayFromDraft(),
      });
    }
  }

  if (
    detail &&
    canWrite &&
    !detail.pricing_locked &&
    (isRateStage(stage) || pendingStayUpdate)
  ) {
    if (pendingStayUpdate && openStay) {
      chips.push({
        id: "update-stay",
        label: `Update stay · ${stayDraft.hotel || openStay.property_name || openStay.city}`,
        variant: "primary",
        onClick: () => {
          setPendingStayUpdate(false);
          void saveStayFromDraft();
        },
      });
    } else if (
      !hideReady &&
      openStay &&
      stayDraftReady(stayDraft) &&
      stayFieldsDiffer(stayDraft, openStay)
    ) {
      chips.push({
        id: "update-stay",
        label: `Update stay · ${stayDraft.hotel}`,
        variant: "secondary",
        onClick: () => {
          setPendingStayUpdate(false);
          void saveStayFromDraft();
        },
      });
    }
  }

  if (
    detail &&
    canWrite &&
    detail.pricing_locked &&
    isRateStage(stage)
  ) {
    const chosenRoom = detail.rates.candidates.find(
      (rate) => rate.selected && rate.leg_id === (openStay?.leg_id ?? null),
    );
    if (pendingCostUpdate) {
      const update = pendingCostUpdate;
      chips.push({
        id: "use-today-cost",
        label: `Use today's cost · ${formatMoney(update.amount, update.currency)}`,
        variant: "primary",
        onClick: () => void commitCostUpdate(update),
      });
    }
    if (!hideReady || pendingRateSearch) {
      const hotel = chosenRoom?.property_name?.trim() || openStay?.property_name?.trim();
      chips.push({
        id: "search-rates",
        label: chosenRoom && hotel ? `Check availability · ${hotel}` : "Check today's price",
        variant: pendingRateSearch || (chosenRoom && !pendingCostUpdate) ? "primary" : "secondary",
        onClick: () => void searchRates(),
      });
      if (chosenRoom && quoteFrozen) {
        const room = chosenRoom.subtitle?.trim() || chosenRoom.title;
        const short = room.length > 28 ? `${room.slice(0, 28).trim()}…` : room;
        chips.push({
          id: "set-room-price",
          label: `Set client price · ${short}`,
          variant: "secondary",
          onClick: () => offerRoomPrice(chosenRoom, `Set client price · ${short}`),
        });
      }
    }
  }

  if (detail && canWrite && !detail.pricing_locked && isRateStage(stage)) {
    if (pendingRateSearch || (!hideReady && stage === "rates")) {
      const partyLabel = partyReady(stayDraft)
        ? `${stayDraft.adults} adults · ${stayDraft.rooms} ${stayDraft.rooms === 1 ? "room" : "rooms"}`
        : null;
      chips.push({
        id: "search-rates",
        label:
          stage !== "rates"
            ? "Search rates"
            : partyLabel
              ? `Search rates · ${partyLabel}`
              : "Add party to search rates",
        variant: "primary",
        onClick: () => void searchRates(),
      });
    } else if (!hideReady) {
      chips.push({
        id: "search-rates",
        label: "Search rates",
        variant: "secondary",
        onClick: () => void searchRates(),
      });
    }

    if (pendingPaste) {
      chips.push({
        id: "paste-rate",
        label: "Use pasted quote",
        variant: "secondary",
        onClick: () => void pasteQuote(pendingPaste),
      });
    }
  }

  const showRateCards =
    stage === "rates" ||
    ((stage === "quote" || stage === "booking") && rateOptions.length > 0);
  const rateCards: TripBuilderRateCard[] =
    detail && canWrite && !detail.pricing_locked && showRateCards
      ? listedRates(rateOptions, detail.rates.candidates, activeLegId).map((choice, index) => {
          if (choice.kind === "search") {
            const explained = explainRate(choice.option);
            return {
              id: `rate-opt-${index}-${choice.option.rate_source_code}`,
              index: index + 1,
              recommended: choice.option.recommended,
              room: explained.room,
              board: explained.board,
              price: explained.price,
              priceRule: explained.why,
              occupancy: explained.occupancy,
              inclusions: explained.benefits,
              cancellation: explained.cancellation,
              onAddToOptions: () => offerAddRoom(choice, null, "Add for the client"),
            };
          }
          const cost = formatMoney(choice.row.cost_internal, choice.row.currency);
          return {
            id: `rate-cand-${choice.row.id}`,
            index: index + 1,
            recommended: false,
            room: choice.title,
            board: choice.row.subtitle,
            price: cost ?? "Not listed",
            priceRule: null,
            occupancy: null,
            inclusions: choice.row.inclusions.slice(0, 4),
            cancellation: cancellationForStay(choice.row.cancellation_policy, null),
            onSelect: () => offerSelectRoom(choice, "Client chose this"),
          };
        })
      : [];

  if (
    detail &&
    canWrite &&
    pendingSell &&
    isRateStage(stage)
  ) {
    chips.push({
      id: "apply-sell",
      label: `Set client price · ${formatMoney(pendingSell.sell_total, pendingSell.sell_currency)}`,
      variant: "secondary",
      onClick: () => void applySell(),
    });
  }

  if (detail && canWrite && pendingOptionCommit && confirmFocus === "add-option") {
    const commit = pendingOptionCommit;
    chips.push({
      id: "add-option",
      label: optionChipLabel(commit),
      variant: "primary",
      onClick: () => void commitOption(commit, optionChipLabel(commit)),
    });
  }

  if (detail && canWrite && pendingOptionSelect && confirmFocus === "select-room") {
    const draft = pendingOptionSelect;
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    chips.push({
      id: "select-room",
      label: `Client chose · ${room}`,
      variant: "primary",
      onClick: () => void commitSelect(draft, `Client chose · ${room}`),
    });
  }

  if (detail && canWrite && pendingOptionsText && confirmFocus === "options-text") {
    const edit = pendingOptionsText;
    chips.push({
      id: "options-text",
      label: edit.field === "title" ? "Set options title" : "Set options note",
      variant: "secondary",
      onClick: () => void commitOptionsText(edit, edit.field === "title" ? "Set options title" : "Set options note"),
    });
  }

  if (detail && canWrite && pendingPdfEdit && confirmFocus === "options-edit") {
    const matches = pendingPdfEdit;
    if (matches.length === 1) {
      chips.push({
        id: "options-edit",
        label: "Change this line",
        variant: "primary",
        onClick: () => void commitPdfEdits(matches, "Change this line"),
      });
    } else {
      chips.push({
        id: "options-edit-all",
        label: "Change every line",
        variant: "primary",
        onClick: () => void commitPdfEdits(matches, "Change every line"),
      });
      matches.slice(0, 6).forEach((row, index) => {
        const short = row.label.length > 32 ? `${row.label.slice(0, 32).trim()}…` : row.label;
        chips.push({
          id: `options-edit-${index}`,
          label: `Only ${short}`,
          variant: "secondary",
          onClick: () => void commitPdfEdits([row], `Only ${short}`),
        });
      });
    }
  }

  if (detail && canWrite && confirmFocus === "options-preview") {
    chips.push({
      id: "open-options",
      label: "Open options quote",
      variant: "primary",
      onClick: () => void openOptionsQuote("Open options quote"),
    });
  }

  if (detail && canWrite && !hideReady && (stage === "quote" || stage === "booking")) {
    chips.push({
      id: "ask-readiness",
      label: "What's missing before booking?",
      variant: "secondary",
      onClick: () => void sendTripChat("What's missing before booking?"),
    });
    chips.push({
      id: "open-trip-page",
      label: "Open trip page",
      variant: "secondary",
      onClick: openTripPage,
    });
  }

  const declineLabel = detail && canWrite && confirmFocus ? DECLINE_LABELS[confirmFocus] : undefined;
  const declineChip: TripBuilderChip | null = declineLabel
    ? { id: "decline", label: declineLabel, variant: "secondary", onClick: () => void handleSend("No") }
    : null;
  const rankedChips = rankChips(chips, declineChip);

  return {
    trips,
    detail,
    summaryOpen,
    setSummaryOpen,
    busy: busy || pending,
    chatBusy,
    canWrite,
    messages,
    chatLoading,
    chatLoadingOlder,
    hasMoreMessages,
    streamingContent,
    agentPhase,
    chips: rankedChips,
    rateCards,
    stayNotes: rateOptions.length > 0 ? rateStayNotes : null,
    activeLegId,
    selectLeg,
    homeChips,
    openTrip,
    newChat,
    createTrip,
    promptCreateTrip,
    handleSend,
    loadOlderMessages,
    openOptionsQuote,
    regenerateOptionsQuote,
    offerChooseSaved,
  };
}
