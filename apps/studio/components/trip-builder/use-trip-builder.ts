"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";

import type { NormalizedRateOption } from "@pureluxe/rates";
import type { SetTripStayBody } from "@pureluxe/shared";

import {
  addTripBuilderRateOption,
  createTripBuilderTrip,
  getTripBuilderTrip,
  listTripBuilderTrips,
  pasteTripBuilderLineItem,
  searchTripBuilderRates,
  selectTripBuilderLineItem,
  setTripBuilderStay,
  updateTripBuilderTrip,
} from "@/lib/api";
import { showApiError, showSuccessToast } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import type { TripDetail, TripListItem } from "@/lib/trip-builder";

type UseTripBuilderOptions = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
  prefillClientId?: string | null;
};

export function useTripBuilder({
  initialTrips,
  initialDetail,
  canWrite,
  prefillClientId = null,
}: UseTripBuilderOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripParam = searchParams.get("trip");

  const [trips, setTrips] = useState(initialTrips);
  const [detail, setDetail] = useState<TripDetail | null>(initialDetail);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rateOptions, setRateOptions] = useState<NormalizedRateOption[]>([]);
  const [rateSearchMessage, setRateSearchMessage] = useState<string | null>(
    null,
  );

  const syncFromUrl = useEffectEvent(async (tripId: string | null) => {
    if (!tripId) {
      setDetail(null);
      setRateOptions([]);
      setRateSearchMessage(null);
      return;
    }
    if (detail?.trip.id === tripId) return;

    try {
      const response = await getTripBuilderTrip(tripId);
      setDetail(response.data);
      setRateOptions([]);
      setRateSearchMessage(null);
    } catch (error) {
      showApiError(error);
      router.replace(pageRoutes.tripBuilder);
      setDetail(null);
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
      // Keep current list; toast only on user actions.
    }
  }

  async function refreshAfterMutation(tripId: string) {
    const [detailResponse] = await Promise.all([
      getTripBuilderTrip(tripId),
      refreshTrips(),
    ]);
    setDetail(detailResponse.data);
  }

  function openTrip(tripId: string) {
    startTransition(() => {
      router.replace(pageRoutes.tripBuilderTrip(tripId));
    });
  }

  async function createTrip(clientId?: string | null) {
    if (!canWrite) return;
    setBusy(true);
    try {
      const response = await createTripBuilderTrip({
        primary_client_id: clientId ?? prefillClientId ?? null,
      });
      setDetail(response.data);
      await refreshTrips();
      showSuccessToast("Trip created.");
      router.replace(pageRoutes.tripBuilderTrip(response.data.trip.id));
    } catch (error) {
      showApiError(error);
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
      await refreshTrips();
      showSuccessToast("Client saved.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveStay(input: SetTripStayBody) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await setTripBuilderStay(detail.trip.id, input);
      setDetail(response.data);
      await refreshTrips();
      showSuccessToast("Stay saved.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function searchRates() {
    if (!canWrite || !detail?.stay?.check_in || !detail.stay.check_out) return;
    setBusy(true);
    try {
      const response = await searchTripBuilderRates({
        trip_id: detail.trip.id,
        leg_id: detail.stay.leg_id,
        destination_text: detail.stay.city,
        property_id: detail.stay.property_id,
        check_in: detail.stay.check_in,
        check_out: detail.stay.check_out,
        adults: 2,
        children: 0,
        rooms: 1,
        paste_text: null,
      });
      setRateOptions(response.data.options);
      setRateSearchMessage(response.data.message);
      if (response.data.options.length === 0) {
        showSuccessToast(response.data.message ?? "No rates found.");
      } else {
        showSuccessToast("Rate search completed.");
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function selectSearchOption(option: NormalizedRateOption) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await addTripBuilderRateOption({
        trip_id: detail.trip.id,
        leg_id: detail.stay?.leg_id ?? null,
        option,
        select: true,
      });
      await refreshAfterMutation(detail.trip.id);
      setRateOptions([]);
      setRateSearchMessage(null);
      showSuccessToast("Rate selected.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function pasteQuote(pasteText: string) {
    if (!canWrite || !detail?.stay?.check_in || !detail.stay.check_out) return;
    setBusy(true);
    try {
      const created = await pasteTripBuilderLineItem({
        trip_id: detail.trip.id,
        leg_id: detail.stay.leg_id,
        property_id: detail.stay.property_id,
        property_name: detail.stay.property_name,
        check_in: detail.stay.check_in,
        check_out: detail.stay.check_out,
        currency: "USD",
        paste_text: pasteText,
      });
      await selectTripBuilderLineItem(created.data.id);
      await refreshAfterMutation(detail.trip.id);
      showSuccessToast("Quote pasted and selected.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function selectCandidate(lineItemId: string) {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      await selectTripBuilderLineItem(lineItemId);
      await refreshAfterMutation(detail.trip.id);
      showSuccessToast("Rate selected.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return {
    trips,
    detail,
    summaryOpen,
    setSummaryOpen,
    busy: busy || pending,
    canWrite,
    prefillClientId,
    rateOptions,
    rateSearchMessage,
    openTrip,
    createTrip,
    assignClient,
    saveStay,
    searchRates,
    selectSearchOption,
    pasteQuote,
    selectCandidate,
  };
}
