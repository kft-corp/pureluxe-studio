import type { NormalizedRateOption } from "@pureluxe/rates";

import type { ClientSearchHit } from "@/lib/api";
import type { TripDetail } from "@/lib/trip-builder";
import { partyReady, stayDraftReady, type MoneyReply, type StayDraft } from "@/lib/trip-builder/intents";

import { cancellationForStay, explainRate } from "./explain-rate";
import { DECLINE_LABELS } from "./offer-reply";
import {
  isRateStage,
  legsConfirmed,
  resolveTripStage,
  travellersConfirmed,
  tripStays,
} from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import {
  formatMoney,
  listedRates,
  optionChipLabel,
  shiftIsoDate,
  shiftLabel,
  stayFieldsDiffer,
  stayOn,
  stayRangeLabel,
  type AtlasHotel,
  type CostUpdate,
  type LegDraft,
  type LegRevision,
  type LegTarget,
  type ListedRate,
  type Offer,
  type OptionCommit,
  type OptionDraft,
  type OptionsTextEdit,
  type PartyChoice,
  type PdfLineEdit,
  type SavedRate,
  type SellDraft,
  type TripDatesDraft,
} from "./trip-builder-helpers";
import type { TripBuilderRateCard } from "./trip-builder-rate-card";

type Run = void | Promise<unknown>;

/** What each chip runs. The hook passes its own functions in. */
export type ComposerChipActions = {
  promptCreateTrip: () => void;
  createTrip: (clientId: string, clientName: string) => Run;
  changeLead: (person: ClientSearchHit, userLine: string) => Run;
  setPartyRole: (person: PartyChoice, userLine: string) => Run;
  addTraveller: (person: PartyChoice, userLine: string) => Run;
  confirmTravellers: (userLine: string) => Run;
  sendTripChat: (message: string) => Run;
  assignClient: (client: ClientSearchHit) => Run;
  chooseClient: (hit: ClientSearchHit) => void;
  saveTripDates: (dates: TripDatesDraft, dropOutside?: boolean) => Run;
  commitShift: (days: number) => Run;
  openTripPage: () => void;
  commitAddLeg: (draft: LegDraft) => Run;
  commitRevise: (draft: LegRevision) => Run;
  commitRemove: (target: LegTarget) => Run;
  saveStayFromDraft: (confirmOverlap?: boolean) => Run;
  updateStay: () => void;
  confirmLegs: () => Run;
  pickAtlasHotel: (hotel: AtlasHotel, userLine: string) => Run;
  commitCostUpdate: (update: CostUpdate) => Run;
  offerRoomPrice: (row: SavedRate, userLine: string) => void;
  searchRates: (source?: StayDraft, userLine?: string) => Run;
  pasteQuote: (text: string) => Run;
  offerAddRoom: (choice: ListedRate, price: MoneyReply | null, userLine: string) => void;
  offerSelectRoom: (choice: ListedRate, userLine: string) => void;
  applySell: (sell: SellDraft) => Run;
  commitOption: (commit: OptionCommit, userLine: string) => Run;
  commitSelect: (draft: OptionDraft, userLine: string) => Run;
  commitOptionsText: (edit: OptionsTextEdit, userLine: string) => Run;
  commitPdfEdits: (matches: PdfLineEdit[], userLine: string) => Run;
  openOptionsQuote: (userLine?: string) => Run;
  handleSend: (text: string) => Run;
};

export type ComposerChipsInput = {
  detail: TripDetail | null;
  canWrite: boolean;
  /** The client accepted the quote. */
  quoteFrozen: boolean;
  activeLegId: string | null;
  stayDraft: StayDraft;
  rateOptions: NormalizedRateOption[];
  suggestedClients: { id: string; display_name: string }[];
  clientHits: ClientSearchHit[];
  leadHits: ClientSearchHit[];
  roleHits: PartyChoice[];
  atlasHotels: AtlasHotel[];
  quietChips: boolean;
  offer: Offer | null;
  offerReopen: boolean;
  /** A room waiting for the client price the advisor types next. */
  pendingOptionDraft: OptionDraft | null;
  pendingCostUpdate: CostUpdate | null;
  actions: ComposerChipActions;
};

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

/** The chips under the composer and the rate cards on the last reply, for the current state. */
export function buildComposerChips(input: ComposerChipsInput): {
  chips: TripBuilderChip[];
  rateCards: TripBuilderRateCard[];
} {
  const {
    detail,
    canWrite,
    quoteFrozen,
    activeLegId,
    stayDraft,
    rateOptions,
    suggestedClients,
    clientHits,
    leadHits,
    roleHits,
    atlasHotels,
    quietChips,
    offer,
    offerReopen,
    pendingOptionDraft,
    pendingCostUpdate,
  } = input;
  const {
    promptCreateTrip,
    createTrip,
    changeLead,
    setPartyRole,
    addTraveller,
    confirmTravellers,
    sendTripChat,
    assignClient,
    chooseClient,
    saveTripDates,
    commitShift,
    openTripPage,
    commitAddLeg,
    commitRevise,
    commitRemove,
    saveStayFromDraft,
    updateStay,
    confirmLegs,
    pickAtlasHotel,
    commitCostUpdate,
    offerRoomPrice,
    searchRates,
    pasteQuote,
    offerAddRoom,
    offerSelectRoom,
    applySell,
    commitOption,
    commitSelect,
    commitOptionsText,
    commitPdfEdits,
    openOptionsQuote,
    handleSend,
  } = input.actions;

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

  const hasConfirm = Boolean(
    offer ||
      leadHits.length > 0 ||
      roleHits.length > 0 ||
      clientHits.length > 0 ||
      offerReopen ||
      pendingOptionDraft ||
      atlasHotels.length > 0,
  );
  const hideReady = quietChips || hasConfirm;
  const rateSearchOffered = offer?.type === "rate-search";
  const offeredLead = offer?.type === "lead" ? offer.person : null;
  const offeredRole = offer?.type === "role" ? offer.person : null;
  const offeredTraveller = offer?.type === "traveller" ? offer.person : null;
  const offeredClient = offer?.type === "assign" ? offer.client : null;

  if (detail && canWrite && offeredLead && !detail.pricing_locked) {
    chips.push({
      id: `make-lead-${offeredLead.id}`,
      label: `Make ${offeredLead.display_name} the lead`,
      variant: "primary",
      onClick: () => void changeLead(offeredLead, `Make ${offeredLead.display_name} the lead`),
    });
  }

  if (detail && canWrite && !offeredLead && leadHits.length > 0 && !detail.pricing_locked) {
    for (const [index, hit] of leadHits.slice(0, 6).entries()) {
      chips.push({
        id: `lead-hit-${hit.id}`,
        label: `Make ${hit.display_name} the lead`,
        variant: index === 0 ? "primary" : "secondary",
        onClick: () => void changeLead(hit, `Make ${hit.display_name} the lead`),
      });
    }
  }

  if (detail && canWrite && offeredRole && !detail.pricing_locked) {
    const kind = offeredRole.party_role === "child" ? "a child" : "an adult";
    chips.push({
      id: `set-role-${offeredRole.id}`,
      label: `Make ${offeredRole.display_name} ${kind}`,
      variant: "primary",
      onClick: () =>
        void setPartyRole(
          offeredRole,
          `Make ${offeredRole.display_name} ${kind}`,
        ),
    });
  }

  if (detail && canWrite && !offeredRole && roleHits.length > 0 && !detail.pricing_locked) {
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

  if (detail && canWrite && offeredTraveller && !detail.pricing_locked) {
    const child = offeredTraveller.party_role === "child";
    chips.push({
      id: `add-traveller-${offeredTraveller.id}`,
      label: child
        ? `Add ${offeredTraveller.display_name} as a child`
        : `Add ${offeredTraveller.display_name}`,
      variant: "primary",
      onClick: () =>
        void addTraveller(
          offeredTraveller,
          child
            ? `Add ${offeredTraveller.display_name} as a child`
            : `Add ${offeredTraveller.display_name}`,
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
    if (!offeredTraveller) {
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
    !offeredTraveller &&
    !offeredLead &&
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
    if (offeredClient) {
      chips.push({
        id: `confirm-client-${offeredClient.id}`,
        label: `Add ${offeredClient.display_name} as the client`,
        variant: "primary",
        onClick: () => void assignClient(offeredClient),
      });
    } else {
      for (const hit of clientHits.slice(0, 6)) {
        chips.push({
          id: `client-${hit.id}`,
          label: `Choose ${hit.display_name}`,
          variant: "secondary",
          onClick: () => chooseClient(hit),
        });
      }
    }
  }

  if (detail && canWrite && offer?.type === "trip-dates" && !detail.pricing_locked) {
    const dates = offer.dates;
    chips.push({
      id: "save-trip-dates",
      label: `Save trip dates · ${stayRangeLabel(dates.checkIn, dates.checkOut)}`,
      variant: "primary",
      onClick: () => void saveTripDates(dates),
    });
  }

  if (detail && canWrite && offer?.type === "shift-trip" && !detail.pricing_locked) {
    const days = offer.days;
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

  if (detail && canWrite && offer?.type === "date-drop" && !detail.pricing_locked) {
    const dates = offer.dates;
    chips.push({
      id: "drop-outside-stays",
      label: "Remove outside stays and save dates",
      variant: "danger",
      onClick: () => void saveTripDates(dates, true),
    });
  }

  if (detail && canWrite && offer?.type === "add-stay" && !detail.pricing_locked) {
    const draft = offer.leg;
    chips.push({
      id: "confirm-add-stay",
      label: draft.confirmOverlap
        ? `Add ${draft.city} anyway`
        : `Add ${draft.city} · ${stayRangeLabel(draft.checkIn, draft.checkOut)}`,
      variant: "primary",
      onClick: () => void commitAddLeg(draft),
    });
  }

  if (detail && canWrite && offer?.type === "revise-stay" && !detail.pricing_locked) {
    const draft = offer.leg;
    chips.push({
      id: "confirm-revise-stay",
      label: draft.confirmOverlap ? `Update ${draft.city} anyway` : `Update ${draft.city}`,
      variant: "primary",
      onClick: () => void commitRevise(draft),
    });
  }

  if (detail && canWrite && offer?.type === "remove-stay" && !detail.pricing_locked) {
    const target = offer.leg;
    chips.push({
      id: "confirm-remove-stay",
      label: `Remove ${target.city}`,
      variant: "danger",
      onClick: () => void commitRemove(target),
    });
  }

  if (detail && canWrite && offer?.type === "stay-overlap" && !detail.pricing_locked) {
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
    offer?.type !== "add-stay"
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
    offer?.type !== "stay-overlap" &&
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
        onClick: () => void pickAtlasHotel(hotel, `Use ${hotel.name}`),
      });
    }
  }

  if (
    detail &&
    canWrite &&
    !hideReady &&
    stage === "stay" &&
    legsConfirmed(detail) &&
    offer?.type !== "stay-overlap"
  ) {
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
    (isRateStage(stage) || offer?.type === "stay-update")
  ) {
    if (offer?.type === "stay-update" && openStay) {
      chips.push({
        id: "update-stay",
        label: `Update stay · ${stayDraft.hotel || openStay.property_name || openStay.city}`,
        variant: "primary",
        onClick: () => updateStay(),
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
        onClick: () => updateStay(),
      });
    }
  }

  const chosenRoom =
    detail && isRateStage(stage)
      ? (detail.rates.candidates.find(
          (rate) => rate.selected && rate.leg_id === (openStay?.leg_id ?? null),
        ) ?? null)
      : null;
  // The server allows price edits on the chosen room before the quote is locked and after the client accepts.
  const canPriceChosen = Boolean(detail && (quoteFrozen || !detail.pricing_locked));

  if (detail && canWrite && isRateStage(stage) && (detail.pricing_locked || chosenRoom)) {
    if (pendingCostUpdate && canPriceChosen) {
      const update = pendingCostUpdate;
      chips.push({
        id: "use-today-cost",
        label: `Use today's cost · ${formatMoney(update.amount, update.currency)}`,
        variant: "primary",
        onClick: () => void commitCostUpdate(update),
      });
    }
    if (!hideReady || rateSearchOffered) {
      const needsPrice = Boolean(chosenRoom && canPriceChosen && chosenRoom.sell_amount == null);
      if (chosenRoom && canPriceChosen) {
        const room = chosenRoom.subtitle?.trim() || chosenRoom.title;
        const short = room.length > 28 ? `${room.slice(0, 28).trim()}…` : room;
        chips.push({
          id: "set-room-price",
          label: `Set client price · ${short}`,
          variant: needsPrice ? "primary" : "secondary",
          onClick: () => offerRoomPrice(chosenRoom, `Set client price · ${short}`),
        });
      }
      const hotel = chosenRoom?.property_name?.trim() || openStay?.property_name?.trim();
      chips.push({
        id: "search-rates",
        label: hotel ? `Search rates again · ${hotel}` : "Search rates again",
        variant:
          rateSearchOffered || (chosenRoom && !needsPrice && !pendingCostUpdate)
            ? "primary"
            : "secondary",
        onClick: () => void searchRates(undefined, hotel ? `Search rates again · ${hotel}` : "Search rates again"),
      });
    }
  }

  if (detail && canWrite && !detail.pricing_locked && isRateStage(stage)) {
    if (!chosenRoom && (rateSearchOffered || (!hideReady && stage === "rates"))) {
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
    } else if (!chosenRoom && !hideReady) {
      chips.push({
        id: "search-rates",
        label: "Search rates",
        variant: "secondary",
        onClick: () => void searchRates(),
      });
    }

    if (offer?.type === "paste") {
      const text = offer.text;
      chips.push({
        id: "paste-rate",
        label: "Use pasted quote",
        variant: "secondary",
        onClick: () => void pasteQuote(text),
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

  if (detail && canWrite && offer?.type === "sell" && isRateStage(stage)) {
    const sell = offer.sell;
    chips.push({
      id: "apply-sell",
      label: `Set client price · ${formatMoney(sell.sell_total, sell.sell_currency)}`,
      variant: "secondary",
      onClick: () => void applySell(sell),
    });
  }

  if (detail && canWrite && offer?.type === "add-option") {
    const commit = offer.commit;
    chips.push({
      id: "add-option",
      label: optionChipLabel(commit),
      variant: "primary",
      onClick: () => void commitOption(commit, optionChipLabel(commit)),
    });
  }

  if (detail && canWrite && offer?.type === "select-room") {
    const draft = offer.room;
    const room = draft.title.length > 32 ? `${draft.title.slice(0, 32).trim()}…` : draft.title;
    chips.push({
      id: "select-room",
      label: `Client chose · ${room}`,
      variant: "primary",
      onClick: () => void commitSelect(draft, `Client chose · ${room}`),
    });
  }

  if (detail && canWrite && offer?.type === "options-text") {
    const edit = offer.edit;
    chips.push({
      id: "options-text",
      label: edit.field === "title" ? "Set options title" : "Set options note",
      variant: "secondary",
      onClick: () => void commitOptionsText(edit, edit.field === "title" ? "Set options title" : "Set options note"),
    });
  }

  if (detail && canWrite && offer?.type === "options-edit") {
    const matches = offer.matches;
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

  if (detail && canWrite && offer?.type === "options-preview") {
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

  const declineLabel = detail && canWrite && offer ? DECLINE_LABELS[offer.type] : undefined;
  const declineChip: TripBuilderChip | null = declineLabel
    ? { id: "decline", label: declineLabel, variant: "secondary", onClick: () => void handleSend("No") }
    : null;

  return { chips: rankChips(chips, declineChip), rateCards };
}
