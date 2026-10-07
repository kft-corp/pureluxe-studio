"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import type { AgentPhase } from "@pureluxe/ai";
import type { NormalizedRateOption } from "@pureluxe/rates";

import {
  addTripBuilderRateOption,
  createTripBuilderTrip,
  generateTripBuilderQuote,
  getTripBuilderQuoteUrl,
  getTripBuilderTrip,
  listTripChatMessages,
  listTripBuilderTrips,
  pasteTripBuilderLineItem,
  searchClients,
  searchTripBuilderRates,
  selectTripBuilderLineItem,
  setTripBuilderStay,
  streamPreTripChat,
  streamTripChat,
  updateTripBuilderQuote,
  updateTripBuilderTrip,
  type ClientSearchHit,
} from "@/lib/api";
import { showApiError, showSuccessToast } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import type {
  ChatMessage,
  TripDetail,
  TripListItem,
} from "@/lib/trip-builder";

import {
  applyChatStreamEvent,
  makeOptimisticUserMessage,
} from "./apply-chat-stream-event";
import {
  mergeStayDraft,
  parseStayMessage,
  stayDraftReady,
  type StayDraft,
} from "./parse-stay-message";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import { resolveTripStage } from "./stages";

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
};

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "";
  const code = currency?.trim() || "";
  return code ? `${code} ${amount}` : String(amount);
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
  const [chatBusy, setChatBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rateOptions, setRateOptions] = useState<NormalizedRateOption[]>([]);
  const [rateSearchMessage, setRateSearchMessage] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(() => Boolean(initialDetail));
  const [chatLoadingOlder, setChatLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [agentPhase, setAgentPhase] = useState<AgentPhase | null>(null);
  const [clientHits, setClientHits] = useState<ClientSearchHit[]>([]);
  const [stayDraft, setStayDraft] = useState<StayDraft>(() =>
    initialDetail?.stay
      ? {
          hotel: initialDetail.stay.property_name ?? "",
          city: initialDetail.stay.city ?? "",
          checkIn: initialDetail.stay.check_in ?? "",
          checkOut: initialDetail.stay.check_out ?? "",
        }
      : EMPTY_STAY,
  );
  const [pendingPaste, setPendingPaste] = useState<string | null>(null);
  const [pendingSell, setPendingSell] = useState<{
    sell_total: number;
    sell_currency: string;
  } | null>(null);
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
    setRateOptions([]);
    setRateSearchMessage(null);
    setPendingPaste(null);
    setPendingSell(null);
  }

  function hydrateStayDraft(next: TripDetail | null) {
    if (!next?.stay) {
      setStayDraft(EMPTY_STAY);
      return;
    }
    setStayDraft({
      hotel: next.stay.property_name ?? "",
      city: next.stay.city ?? "",
      checkIn: next.stay.check_in ?? "",
      checkOut: next.stay.check_out ?? "",
    });
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
        setDetail(response.data);
        hydrateStayDraft(response.data);
        setClientHits([]);
        setRateOptions([]);
        setRateSearchMessage(null);
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
    setStayDraft(EMPTY_STAY);
    chatLoadedForTripRef.current = null;
    skipChatLoadForTripRef.current = null;
    startTransition(() => {
      router.replace(pageRoutes.tripBuilder);
    });
  }

  async function createTrip(clientId?: string | null) {
    if (!canWrite) return null;
    const lastUserIntent =
      [...messages].reverse().find((row) => row.role === "user")?.content ??
      null;
    setBusy(true);
    try {
      const response = await createTripBuilderTrip({
        primary_client_id: clientId ?? prefillClientId ?? null,
      });
      setDetail(response.data);
      setClientHits([]);
      setRateOptions([]);
      setRateSearchMessage(null);
      setPendingPaste(null);
      setPendingSell(null);
      setStreamingContent(null);
      setAgentPhase(null);
      setMessages([]);
      setHasMoreMessages(false);
      setChatLoading(false);
      hydrateStayDraft(response.data);
      skipChatLoadForTripRef.current = response.data.trip.id;
      chatLoadedForTripRef.current = response.data.trip.id;
      await refreshTrips();
      showSuccessToast("Trip created.");
      router.replace(pageRoutes.tripBuilderTrip(response.data.trip.id));

      // Carry last pre-trip intent into real on-trip chat.
      const bridge = lastUserIntent
        ? `I just created this trip. Continue helping based on: ${lastUserIntent}`
        : "I just created this trip. Help with the next step.";
      await sendTripChat(bridge, response.data);

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
      await refreshTrips();
      showSuccessToast("Client saved.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveStayFromDraft() {
    if (!canWrite || !detail || !stayDraftReady(stayDraft)) return;
    if (detail.pricing_locked) {
      showApiError(new Error("Pricing is locked on this trip."));
      return;
    }
    setBusy(true);
    try {
      const response = await setTripBuilderStay(detail.trip.id, {
        city: stayDraft.city.trim(),
        property_name: stayDraft.hotel.trim(),
        property_id: detail.stay?.property_id ?? null,
        check_in: stayDraft.checkIn,
        check_out: stayDraft.checkOut,
      });
      setDetail(response.data);
      hydrateStayDraft(response.data);
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
      setPendingPaste(null);
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
      setPendingPaste(null);
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

  async function applySell() {
    if (!canWrite || !detail || !pendingSell) return;
    setBusy(true);
    try {
      const response = await updateTripBuilderQuote(detail.trip.id, {
        sell_total: pendingSell.sell_total,
        sell_currency: pendingSell.sell_currency,
      });
      setDetail(response.data.detail);
      setPendingSell(null);
      showSuccessToast("Sell price saved.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function generateQuote() {
    if (!canWrite || !detail) return;
    setBusy(true);
    try {
      const response = await generateTripBuilderQuote(detail.trip.id, {});
      setDetail(response.data.detail);
      await refreshTrips();
      showSuccessToast("Quote PDF generated.");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function openQuotePdf() {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await getTripBuilderQuoteUrl(detail.trip.id);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
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

  async function handleSend(text: string) {
    const message = text.trim();
    if (!message || !canWrite) return;

    // No open trip → home agent. Trip is created only via Create trip chip.
    if (!detail) {
      void searchClientsForMessage(message);
      await sendHomeChat(message);
      return;
    }

    const stage = resolveTripStage(detail);

    if (stage === "client") {
      void searchClientsForMessage(message);
    }
    if (stage === "stay") {
      setStayDraft((prev) => mergeStayDraft(prev, parseStayMessage(message)));
    }
    if (stage === "rates" && message.length >= 80) {
      setPendingPaste(message);
    }
    if (stage === "package") {
      const sell = parseSellMessage(message);
      if (sell) setPendingSell(sell);
    }

    await sendTripChat(message);
  }

  const stage = resolveTripStage(detail);
  const chips: TripBuilderChip[] = [];

  if (!detail && canWrite) {
    chips.push({
      id: "create-trip",
      label: "Create trip",
      variant: "primary",
      icon: "plus",
      onClick: () => void createTrip(),
    });

    for (const hit of clientHits.slice(0, 6)) {
      chips.push({
        id: `draft-client-${hit.id}`,
        label: `Create trip · ${hit.display_name}`,
        variant: "secondary",
        onClick: () => void createTrip(hit.id),
      });
    }
  }

  const homeChips: TripBuilderChip[] =
    !detail && canWrite
      ? [
          {
            id: "start-client",
            label: "Start a client trip",
            onClick: () =>
              void handleSend("I want to start a trip for a client"),
          },
          {
            id: "start-hotel",
            label: "Quote a named hotel",
            onClick: () =>
              void handleSend("I want to quote a named hotel"),
          },
          {
            id: "start-paste",
            label: "Paste a hotel quote",
            onClick: () =>
              void handleSend("I want to paste a hotel quote"),
          },
        ]
      : [];

  if (detail && canWrite && stage === "client") {
    for (const hit of clientHits.slice(0, 8)) {
      chips.push({
        id: `client-${hit.id}`,
        label: `Use ${hit.display_name}`,
        variant: "primary",
        onClick: () => void assignClient(hit.id),
      });
    }
  }

  if (detail && canWrite && stage === "stay") {
    if (stayDraftReady(stayDraft) && !detail.pricing_locked) {
      chips.push({
        id: "save-stay",
        label: `Save stay · ${stayDraft.hotel} · ${stayDraft.city}`,
        variant: "primary",
        onClick: () => void saveStayFromDraft(),
      });
    }
  }

  if (detail && canWrite && stage === "rates") {
    chips.push({
      id: "search-rates",
      label: "Search rates",
      variant: "primary",
      onClick: () => void searchRates(),
    });

    if (pendingPaste) {
      chips.push({
        id: "paste-rate",
        label: "Paste last message as rate",
        variant: "secondary",
        onClick: () => void pasteQuote(pendingPaste),
      });
    }

    for (const [index, option] of rateOptions.slice(0, 6).entries()) {
      const money = formatMoney(option.cost_internal, option.currency);
      const labelBase =
        option.room_name || option.property_name || option.rate_source_code;
      chips.push({
        id: `rate-opt-${index}-${option.rate_source_code}`,
        label: money ? `Select · ${labelBase} · ${money}` : `Select · ${labelBase}`,
        variant: "secondary",
        onClick: () => void selectSearchOption(option),
      });
    }

    for (const row of detail.rates.candidates.slice(0, 6)) {
      if (row.selected) continue;
      const money = formatMoney(row.cost_internal, row.currency);
      chips.push({
        id: `rate-cand-${row.id}`,
        label: money ? `Saved · ${row.title} · ${money}` : `Saved · ${row.title}`,
        variant: "secondary",
        onClick: () => void selectCandidate(row.id),
      });
    }
  }

  if (detail && canWrite && stage === "package") {
    if (pendingSell) {
      chips.push({
        id: "apply-sell",
        label: `Set sell ${pendingSell.sell_currency} ${pendingSell.sell_total}`,
        variant: "secondary",
        onClick: () => void applySell(),
      });
    }
    chips.push({
      id: "generate-pdf",
      label: "Generate quote PDF",
      variant: "primary",
      onClick: () => void generateQuote(),
    });
  }

  if (detail && stage === "quote") {
    chips.push({
      id: "open-pdf",
      label: "Open quote PDF",
      variant: "primary",
      onClick: () => void openQuotePdf(),
    });
  }

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
    chips,
    homeChips,
    openTrip,
    newChat,
    createTrip,
    handleSend,
    loadOlderMessages,
  };
}
