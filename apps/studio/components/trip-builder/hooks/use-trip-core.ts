"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { NormalizedRateOption } from "@pureluxe/rates";

import { getTripBuilderTrip, listTripBuilderTrips, type ClientSearchHit } from "@/lib/api";
import type { StayDraft } from "@/lib/trip-builder/intents";
import { isQuoteAccepted, isTripClosed } from "@/lib/trip-builder/trip-lock";
import type { TripDetail, TripListItem } from "@/lib/trip-builder";

import {
  draftFromStay,
  withPartyCounts,
  stayOn,
  type AtlasHotel,
  type CostUpdate,
  type Offer,
  type OptionDraft,
  type PartyChoice,
} from "../trip-builder-helpers";
import type { TripBuilderStayNotes } from "../trip-builder-rate-card";

export type UseTripBuilderOptions = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
  prefillClientId?: string | null;
};

/** Shared state: the open trip, the open question, the stay draft, and the search hits behind the chips. */
export function useTripCore({
  initialTrips,
  initialDetail,
  canWrite: canWriteProp,
}: UseTripBuilderOptions) {
  const router = useRouter();
  const [trips, setTrips] = useState(initialTrips);
  const [detail, setDetail] = useState<TripDetail | null>(initialDetail);
  const canWrite = canWriteProp && !(detail && isTripClosed(detail.trip.status));
  /** The client accepted this quote. The options PDF stays as sent until the quote is reopened. */
  const quoteFrozen = Boolean(detail && isQuoteAccepted(detail.trip.status));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rateOptions, setRateOptions] = useState<NormalizedRateOption[]>([]);
  const [rateStayNotes, setRateStayNotes] = useState<TripBuilderStayNotes | null>(null);
  const [clientHits, setClientHits] = useState<ClientSearchHit[]>([]);
  const [suggestedClients, setSuggestedClients] = useState<
    { id: string; display_name: string }[]
  >([]);
  const [leadHits, setLeadHits] = useState<ClientSearchHit[]>([]);
  const [roleHits, setRoleHits] = useState<PartyChoice[]>([]);
  const [quietChips, setQuietChips] = useState(false);
  const firstLegId =
    initialDetail?.stays?.[0]?.leg_id ?? initialDetail?.stay?.leg_id ?? null;
  const activeLegIdRef = useRef<string | null>(firstLegId);
  const [activeLegId, setActiveLegId] = useState<string | null>(firstLegId);
  const [stayDraft, setStayDraft] = useState<StayDraft>(() =>
    draftFromStay(stayOn(initialDetail, firstLegId)),
  );
  /** The one question waiting on yes or no. */
  const [offer, setOffer] = useState<Offer | null>(null);
  const [offerReopen, setOfferReopen] = useState(false);
  /** A room waiting for the client price the advisor types next. */
  const [pendingOptionDraft, setPendingOptionDraft] = useState<OptionDraft | null>(null);
  /** Today's hotel price for the client's chosen room, offered after a price check. */
  const [pendingCostUpdate, setPendingCostUpdate] = useState<CostUpdate | null>(null);
  const [atlasPlace, setAtlasPlace] = useState<{
    city: string | null;
    country: string | null;
  } | null>(null);
  const [atlasHotels, setAtlasHotels] = useState<AtlasHotel[]>([]);

  function closeOffer(...types: Offer["type"][]) {
    setOffer((current) => (current && types.includes(current.type) ? null : current));
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

  function quoteRefreshNote(): string {
    return detail?.quote.document?.status === "ready"
      ? "\n\nThe quote PDF is out of date. Generate it again when the stays are set."
      : "";
  }

  function clearOfferedChips() {
    setLeadHits([]);
    setRoleHits([]);
    setClientHits([]);
    setOfferReopen(false);
    setPendingOptionDraft(null);
    setPendingCostUpdate(null);
    setOffer(null);
    setAtlasHotels([]);
  }

  function clearStayPrompts() {
    closeOffer(
      "trip-dates",
      "shift-trip",
      "date-drop",
      "remove-stay",
      "revise-stay",
      "add-stay",
      "stay-overlap",
      "stay-update",
    );
  }

  return {
    router,
    trips,
    setTrips,
    detail,
    setDetail,
    canWrite,
    quoteFrozen,
    summaryOpen,
    setSummaryOpen,
    busy,
    setBusy,
    rateOptions,
    setRateOptions,
    rateStayNotes,
    setRateStayNotes,
    clientHits,
    setClientHits,
    suggestedClients,
    setSuggestedClients,
    leadHits,
    setLeadHits,
    roleHits,
    setRoleHits,
    quietChips,
    setQuietChips,
    activeLegIdRef,
    activeLegId,
    setActiveLegId,
    stayDraft,
    setStayDraft,
    offer,
    setOffer,
    offerReopen,
    setOfferReopen,
    pendingOptionDraft,
    setPendingOptionDraft,
    pendingCostUpdate,
    setPendingCostUpdate,
    atlasPlace,
    setAtlasPlace,
    atlasHotels,
    setAtlasHotels,
    closeOffer,
    chooseLeg,
    hydrateStayDraft,
    refreshTrips,
    refreshAfterMutation,
    quoteRefreshNote,
    clearOfferedChips,
    clearStayPrompts,
  };
}

export type TripCore = ReturnType<typeof useTripCore>;
