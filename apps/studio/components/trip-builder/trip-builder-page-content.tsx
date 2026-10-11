"use client";

import type { TripDetail, TripListItem } from "@/lib/trip-builder";

import { TripBuilderChatPane } from "./trip-builder-chat-pane";
import { TripBuilderComposer } from "./trip-builder-composer";
import { TripBuilderHeader } from "./trip-builder-header";
import { TripBuilderStatusStrip } from "./trip-builder-status-strip";
import { TripBuilderSummaryPanel } from "./trip-builder-summary-panel";
import { legsConfirmed, resolveTripStage, tripDatesReady } from "./stages";
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

  const stage = resolveTripStage(builder.detail);
  const composerBusy = builder.busy || builder.chatBusy;
  const tripOpen = Boolean(builder.detail);

  const helperText = !tripOpen
    ? "Ask about clients anytime. Tap Create trip when ready to build."
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
            ? "Tap Add for the client on a room. Ask if you want help choosing."
            : "The room is chosen. The booking stays pending until you confirm it in Bookings.";

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface">
      <TripBuilderHeader
        trips={builder.trips}
        detail={builder.detail}
        summaryOpen={builder.summaryOpen}
        canWrite={builder.canWrite}
        busy={builder.busy}
        onOpenTrip={builder.openTrip}
        onNewChat={builder.newChat}
        onToggleSummary={() =>
          builder.setSummaryOpen((open) => !open)
        }
      />

      {/* Status / Next strip only when a trip exists */}
      <TripBuilderStatusStrip
        detail={builder.detail}
        activeLegId={builder.activeLegId}
        onSelectLeg={builder.selectLeg}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#faf9f7_100%)]">
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
              homeChips={builder.homeChips}
              rateCards={builder.rateCards}
              stayNotes={builder.stayNotes}
              activeLegId={builder.activeLegId}
              onCreateTrip={builder.promptCreateTrip}
              onLoadOlder={() => void builder.loadOlderMessages()}
            />
          </div>

          <TripBuilderComposer
            placeholder={
              tripOpen
                ? "Message your agent…"
                : "Ask about a client — or Create trip when ready…"
            }
            helperText={helperText}
            chips={builder.chips}
            disabled={composerBusy || (!canWrite && tripOpen)}
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
