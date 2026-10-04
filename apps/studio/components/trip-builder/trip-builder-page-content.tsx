"use client";

import { useState } from "react";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";

import { TripBuilderChatPane } from "./trip-builder-chat-pane";
import { TripBuilderComposer } from "./trip-builder-composer";
import type { TripBuilderDraft } from "./trip-builder-draft";
import { TripBuilderHeader } from "./trip-builder-header";
import { TripBuilderStatusStrip } from "./trip-builder-status-strip";
import { TripBuilderSummaryPanel } from "./trip-builder-summary-panel";
import { resolveTripStage } from "./trip-stages";
import { useTripBuilder } from "./use-trip-builder";

type TripBuilderPageContentProps = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
  prefillClientId?: string | null;
};

export function TripBuilderPageContent({
  initialTrips,
  initialDetail,
  canWrite,
  prefillClientId = null,
}: TripBuilderPageContentProps) {
  const builder = useTripBuilder({
    initialTrips,
    initialDetail,
    canWrite,
    prefillClientId,
  });
  const [notices, setNotices] = useState<string[]>([]);
  const [draft, setDraft] = useState<TripBuilderDraft | null>(null);

  function pushNotice(text: string) {
    setNotices((prev) => [...prev.slice(-6), text]);
  }

  function startWithIntent(intent: "client" | "hotel", note?: string) {
    if (!canWrite) return;
    // Client step always comes first; hotel focus/name applies once Stay opens.
    setDraft({
      focus: intent,
      clientQuery: intent === "client" ? note : undefined,
      hotelName: intent === "hotel" ? note : undefined,
    });
    if (note) pushNotice(note);
    void builder.createTrip();
  }

  function handleSend(text: string) {
    if (!builder.detail) {
      // Free-typed note before a trip exists → start trip and seed client search.
      startWithIntent("client", text);
      return;
    }

    pushNotice(text);

    const stage = resolveTripStage(builder.detail);
    if (stage === "client") {
      setDraft({
        focus: "client",
        clientQuery: text,
        hotelName: draft?.hotelName,
      });
      return;
    }
    if (stage === "stay") {
      setDraft({
        focus: "hotel",
        hotelName: text,
        clientQuery: draft?.clientQuery,
      });
    }
  }

  const stage = resolveTripStage(builder.detail);
  const chips =
    !builder.detail && canWrite
      ? [
          {
            id: "client",
            label: "Start a client trip",
            onClick: () => startWithIntent("client"),
          },
          {
            id: "hotel",
            label: "Quote a named hotel",
            onClick: () => startWithIntent("hotel"),
          },
        ]
      : stage === "client" && canWrite
        ? [
            {
              id: "focus-client",
              label: "Search client",
              onClick: () =>
                setDraft({
                  focus: "client",
                  clientQuery: draft?.clientQuery,
                  hotelName: draft?.hotelName,
                }),
            },
          ]
        : stage === "stay" && canWrite
          ? [
              {
                id: "focus-hotel",
                label: "Set hotel name",
                onClick: () =>
                  setDraft({
                    focus: "hotel",
                    hotelName: draft?.hotelName,
                    clientQuery: draft?.clientQuery,
                  }),
              },
            ]
          : stage === "rates" && canWrite
            ? [
                {
                  id: "search-rates",
                  label: "Search rates",
                  onClick: () => void builder.searchRates(),
                },
              ]
            : [];

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface-raised">
      {/* Full-width chrome — summary sits below this, never over it */}
      <TripBuilderHeader
        trips={builder.trips}
        detail={builder.detail}
        summaryOpen={builder.summaryOpen}
        canWrite={builder.canWrite}
        busy={builder.busy}
        onOpenTrip={builder.openTrip}
        onNewTrip={() => {
          setDraft({ focus: "client" });
          void builder.createTrip();
        }}
        onToggleSummary={() =>
          builder.setSummaryOpen((open) => !open)
        }
      />

      <TripBuilderStatusStrip detail={builder.detail} />

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
            <TripBuilderChatPane
              detail={builder.detail}
              canWrite={builder.canWrite}
              busy={builder.busy}
              notices={notices}
              draft={draft}
              rateOptions={builder.rateOptions}
              rateSearchMessage={builder.rateSearchMessage}
              onNewTrip={() => {
                setDraft({ focus: "client" });
                void builder.createTrip();
              }}
              onAssignClient={(clientId) => void builder.assignClient(clientId)}
              onSaveStay={(input) => void builder.saveStay(input)}
              onSearchRates={() => void builder.searchRates()}
              onSelectRateOption={(option) =>
                void builder.selectSearchOption(option)
              }
              onSelectRateCandidate={(lineItemId) =>
                void builder.selectCandidate(lineItemId)
              }
              onPasteQuote={(text) => void builder.pasteQuote(text)}
              onStarter={(intent) => startWithIntent(intent)}
            />
          </div>

          <TripBuilderComposer
            placeholder="Ask Trip Builder…"
            helperText={
              builder.detail
                ? stage === "client" || stage === "stay"
                  ? "Notes fill the form above — the agent isn’t online yet."
                  : stage === "rates"
                    ? "Use Search rates or paste a quote above — the agent isn’t online yet."
                    : "Package is set — quote editing lands next."
                : "Notes for this trip — the agent lands next. Chips jump to the right step."
            }
            chips={chips}
            disabled={builder.busy}
            onSend={handleSend}
          />
        </div>

        <TripBuilderSummaryPanel
          detail={builder.detail}
          open={builder.summaryOpen}
          onClose={() => builder.setSummaryOpen(false)}
        />
      </div>
    </div>
  );
}
