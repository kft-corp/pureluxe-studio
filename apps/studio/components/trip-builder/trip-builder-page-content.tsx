"use client";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";

import { TripBuilderChatPane } from "./trip-builder-chat-pane";
import { TripBuilderComposer } from "./trip-builder-composer";
import { TripBuilderHeader } from "./trip-builder-header";
import { TripBuilderStatusStrip } from "./trip-builder-status-strip";
import { TripBuilderSummaryPanel } from "./trip-builder-summary-panel";
import {
  legsConfirmed,
  resolveTripStage,
  staysAwaitingRoom,
  tripDatesReady,
} from "./stages";
import { useTripBuilder } from "./use-trip-builder";

type TripBuilderPageContentProps = {
  initialTrips: TripListItem[];
  initialDetail: TripDetail | null;
  canWrite: boolean;
};

export function TripBuilderPageContent({
  initialTrips,
  initialDetail,
  canWrite,
}: TripBuilderPageContentProps) {
  const builder = useTripBuilder({
    initialTrips,
    initialDetail,
    canWrite,
  });

  const stage = resolveTripStage(builder.detail);
  const tripOpen = Boolean(builder.detail);
  const queuedNotice =
    builder.queuedCount > 0
      ? `${builder.queuedCount === 1 ? "1 message" : `${builder.queuedCount} messages`} queued — sends when the agent finishes.`
      : undefined;

  const helperText = !tripOpen
    ? undefined
    : builder.chatBusy
      ? undefined
      : stage === "client"
        ? builder.detail?.client && !builder.detail.trip.travellers_confirmed_at
          ? "Add travellers from the household, or say just them."
          : "Type a client name, then tap a confirm chip."
        : stage === "stay"
          ? !tripDatesReady(builder.detail)
            ? "Send the trip start and end first. Example: Start: 2026-10-10, End: 2026-10-20."
            : !legsConfirmed(builder.detail)
              ? "List each stay inside the trip. A city alone uses the full trip for the first stay."
              : "Plan the open stay. You can add a stay, change one, or change the trip dates in chat."
          : stage === "rates"
            ? "Ask in chat to add a room to the quote, or for help choosing."
            : stage === "quote"
              ? builder.detail?.trip.status === "building"
                ? "Check the options quote, then send it and update the status on the trip page."
                : "When they agree, mark Client said yes on the trip page, then tap This is their room."
              : staysAwaitingRoom(builder.detail) > 0
                ? "Tap This is their room, then check today's price and travel prep before booking."
                : "Check today's price, book offline, Confirm hotel booking in Bookings with the PNR, then record payment on the trip.";

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-surface">
      <TripBuilderHeader
        trips={builder.trips}
        detail={builder.detail}
        summaryOpen={builder.summaryOpen}
        canWrite={builder.canWrite}
        busy={builder.busy}
        activeLegId={builder.activeLegId}
        onSelectLeg={builder.selectLeg}
        onOpenTrip={builder.openTrip}
        onNewChat={builder.newChat}
        onToggleSummary={() =>
          builder.setSummaryOpen((open) => !open)
        }
      />

      <TripBuilderStatusStrip detail={builder.detail} />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section className="agent-chat-backdrop flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <TripBuilderChatPane
              detail={builder.detail}
              canWrite={builder.canWrite}
              busy={builder.busy}
              messages={builder.messages}
              chatLoading={builder.chatLoading}
              chatLoadingOlder={builder.chatLoadingOlder}
              hasMoreMessages={builder.hasMoreMessages}
              streamingContent={builder.streamingContent}
              agentPhase={builder.agentPhase}
              agentSteps={builder.agentSteps}
              rateCards={builder.rateCards}
              rateCompare={builder.rateCompare}
              stayNotes={builder.stayNotes}
              activeLegId={builder.activeLegId}
              onLoadOlder={() => void builder.loadOlderMessages()}
              onAddRateOption={builder.addRateOption}
              onContinueIncomplete={
                builder.canWrite ? () => void builder.continueIncomplete() : undefined
              }
            />
          </div>

          <TripBuilderComposer
            placeholder={
              tripOpen
                ? "Message your agent…"
                : "Plan a trip, or ask about a client…"
            }
            helperText={helperText}
            notice={queuedNotice}
            chips={builder.chips}
            disabled={builder.busy || (!canWrite && tripOpen)}
            streaming={builder.chatBusy || builder.busy}
            onSend={(text) => void builder.handleSend(text)}
          />
        </section>

        <TripBuilderSummaryPanel
          detail={builder.detail}
          activeLegId={builder.activeLegId}
          open={builder.summaryOpen}
          canWrite={builder.canWrite}
          busy={builder.busy}
          onClose={() => builder.setSummaryOpen(false)}
          onSelectStay={builder.selectLeg}
          onOpenOptions={() => void builder.openOptionsQuote()}
          onRegenerateOptions={() => void builder.regenerateOptionsQuote()}
          onChooseSavedOption={(lineItemId) => builder.offerChooseSaved(lineItemId)}
        />
      </div>
    </div>
  );
}
