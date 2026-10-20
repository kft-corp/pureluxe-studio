"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { NormalizedRateOption } from "@pureluxe/rates";

import { getTripBuilderTrip, listTripBuilderTrips } from "@/lib/api";
import type { StayDraft } from "@/lib/trip-builder/intents";
import { isQuoteAccepted, isTripClosed } from "@/lib/trips/trip-status";
import type { TripDetail, TripListItem } from "@/lib/trip-builder";

import {
  draftFromStay,
  withPartyCounts,
  stayOn,
  type CostUpdate,
  type Offer,
  type OptionDraft,
} from "../trip-builder-helpers";
import type { TripBuilderStayNotes } from "../trip-builder-rate-card";

export type UseTripBuilderOptions = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
  prefillClientId?: string | null;
};

/** Shared state: the open trip, the open stay, the open question, and the rate search draft. */
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
  /** Clients the home chat found, offered as Create trip chips. */
  const [suggestedClients, setSuggestedClients] = useState<
    { id: string; display_name: string }[]
  >([]);
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
  /** A room waiting for the client price the advisor types next. */
  const [pendingOptionDraft, setPendingOptionDraft] = useState<OptionDraft | null>(null);
  /** Today's hotel price for the client's chosen room, offered after a price check. */
  const [pendingCostUpdate, setPendingCostUpdate] = useState<CostUpdate | null>(null);

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

  /** Open another stay from the stay row. */
  function selectLeg(legId: string) {
    if (!detail || legId === activeLegIdRef.current) return;
    chooseLeg(legId);
    setStayDraft(withPartyCounts(draftFromStay(stayOn(detail, legId)), detail));
    setRateOptions([]);
    closeOffer("rate-search", "paste");
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

  function clearOfferedChips() {
    setPendingOptionDraft(null);
    setPendingCostUpdate(null);
    setOffer(null);
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
    suggestedClients,
    setSuggestedClients,
    quietChips,
    setQuietChips,
    activeLegIdRef,
    activeLegId,
    setActiveLegId,
    stayDraft,
    setStayDraft,
    offer,
    setOffer,
    pendingOptionDraft,
    setPendingOptionDraft,
    pendingCostUpdate,
    setPendingCostUpdate,
    closeOffer,
    chooseLeg,
    hydrateStayDraft,
    selectLeg,
    refreshTrips,
    refreshAfterMutation,
    clearOfferedChips,
  };
}

export type TripCore = ReturnType<typeof useTripCore>;
