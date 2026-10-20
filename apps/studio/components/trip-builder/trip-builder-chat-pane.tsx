"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuArrowDown, LuSparkles } from "react-icons/lu";

import { AGENT_PHASE_LABEL, type AgentPhase } from "@pureluxe/ai/chat-stream";

import { studioButtonClass } from "@/components/ui";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { ChatMarkdown } from "./chat-markdown";
import { stayAskText } from "./stay-prompt";
import { resolveTripStage } from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";
import {
  TripBuilderRateCard,
  TripBuilderStayNotesCard,
  type TripBuilderRateCard as RateCard,
  type TripBuilderStayNotes,
} from "./trip-builder-rate-card";
import { ChatSkeleton } from "./trip-builder-skeleton";

type TripBuilderChatPaneProps = {
  detail: TripDetail | null;
  canWrite: boolean;
  busy: boolean;
  messages: ChatMessage[];
  chatLoading: boolean;
  chatLoadingOlder: boolean;
  hasMoreMessages: boolean;
  streamingContent: string | null;
  agentPhase: AgentPhase | null;
  /** What the agent is looking up, e.g. "Searching clients…". */
  agentProgress: string | null;
  homeChips: TripBuilderChip[];
  rateCards: RateCard[];
  stayNotes: TripBuilderStayNotes | null;
  activeLegId?: string | null;
  onCreateTrip: () => void;
  onLoadOlder: () => void;
};

/** The live status line: the lookup in progress, else the phase. */
function agentStatusLabel(phase: AgentPhase | null, progress: string | null): string | null {
  if (phase === "looking_up" && progress) return progress;
  return phase ? AGENT_PHASE_LABEL[phase] : null;
}

/** Full-width chat thread — agent left, you right. */
export function TripBuilderChatPane({
  detail,
  canWrite,
  busy,
  messages,
  chatLoading,
  chatLoadingOlder,
  hasMoreMessages,
  streamingContent,
  agentPhase,
  agentProgress,
  homeChips,
  rateCards,
  stayNotes,
  activeLegId = null,
  onCreateTrip,
  onLoadOlder,
}: TripBuilderChatPaneProps) {
  const hasDraftThread =
    !detail && (messages.length > 0 || streamingContent != null);

  if (chatLoading && !detail) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col px-4 pt-4 pb-3 sm:px-6">
        <ChatSkeleton />
      </div>
    );
  }

  if (!detail && !hasDraftThread) {
    return (
      <div className="h-full min-h-0 w-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col justify-center px-4 py-6 text-center sm:py-16">
        <h2 className="font-serif text-[1.65rem] leading-tight font-medium tracking-tight text-ink sm:text-[2.05rem]">
          What do you need?
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-ink-muted sm:text-[15px]">
          I’m your{" "}
          <strong className="font-semibold text-ink">PureLuxe agent</strong> — I
          can look up clients and answer questions about them. Tap{" "}
          <strong className="font-semibold text-ink">Create trip</strong> when
          you’re ready to build.
        </p>

        <div className="mt-6 flex justify-center sm:mt-8">
          {canWrite ? (
            <button
              type="button"
              disabled={busy}
              onClick={onCreateTrip}
              className={studioButtonClass(
                "primary",
                "md",
                "min-w-[148px] h-11 rounded-[10px] text-sm sm:h-10",
              )}
            >
              Create trip
            </button>
          ) : (
            <p className="max-w-sm text-center text-xs text-ink-muted">
              You can open assigned trips above. Creating trips needs write
              access.
            </p>
          )}
        </div>

        {homeChips.length > 0 ? (
          <div className="mt-6 sm:mt-7">
            <p className="mb-2 text-[12px] text-ink-muted">Try saying</p>
            <div className="flex flex-wrap justify-center gap-2">
              {homeChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={busy || !canWrite}
                  onClick={chip.onClick}
                  className={cn(
                    "inline-flex min-h-10 max-w-full items-center rounded-full bg-surface-subtle px-3 py-2 text-left text-[13px] font-medium leading-snug break-words text-ink ring-1 ring-border transition-colors lg:min-h-7 lg:py-1 lg:leading-none",
                    "hover:bg-accent-soft hover:text-accent-ink hover:ring-accent-line",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      </div>
    );
  }

  const showWelcome =
    Boolean(detail) &&
    !chatLoading &&
    messages.length === 0 &&
    streamingContent == null;

  return (
    <ChatScrollArea
      chatLoading={chatLoading}
      chatLoadingOlder={chatLoadingOlder}
      hasMoreMessages={hasMoreMessages && Boolean(detail)}
      onLoadOlder={onLoadOlder}
      messages={messages}
      streamingContent={streamingContent}
      agentStatus={agentStatusLabel(agentPhase, agentProgress)}
      lookingUp={agentPhase === "looking_up"}
      busy={busy}
      welcomeContent={
        detail && showWelcome
          ? tripWelcomeMessage(detail, resolveTripStage(detail), activeLegId)
          : null
      }
      rateCards={streamingContent ? [] : rateCards}
      stayNotes={streamingContent ? null : stayNotes}
      offersDisabled={busy}
      banner={<AgentStatusBanner detail={detail} />}
    />
  );
}

function tripWelcomeMessage(
  detail: TripDetail,
  stage: ReturnType<typeof resolveTripStage>,
  activeLegId: string | null,
): string {
  if (stage === "client") {
    return "I've created this trip. Tell me which client it is for, and a confirm chip will appear before they are added.";
  }
  return stageCueFor(detail, stage, activeLegId);
}

function AgentAvatar({
  size = "md",
  thinking = false,
  className,
}: {
  size?: "sm" | "md";
  thinking?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-avatar-hero text-avatar-hero-ink shadow-sm ring-1 ring-inset ring-accent/40",
        size === "sm" ? "h-7 w-7 sm:h-8 sm:w-8" : "h-8 w-8",
        className,
      )}
    >
      <LuSparkles
        className={cn(
          size === "sm" ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4",
          thinking && "animate-pulse motion-reduce:animate-none",
        )}
        strokeWidth={1.75}
      />
    </div>
  );
}

function AgentStatusBanner({ detail }: { detail: TripDetail | null }) {
  return (
    <div className="mb-3 flex w-full items-start gap-2.5 rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5 sm:mb-4">
      <AgentAvatar className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-accent-ink">
          PureLuxe trip builder
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink">
          {!detail
            ? "Hi — I’m your trip builder agent. Chat for client info, or tap Create trip when you’re ready to plan."
            : "Hi — I’ll help you plan this trip. Ask anything, or use chips to confirm the next step."}
        </p>
      </div>
    </div>
  );
}

function ChatScrollArea({
  banner,
  chatLoading,
  chatLoadingOlder,
  hasMoreMessages,
  onLoadOlder,
  messages,
  streamingContent,
  agentStatus,
  lookingUp,
  busy,
  welcomeContent,
  rateCards,
  stayNotes,
  offersDisabled,
}: {
  banner: React.ReactNode;
  chatLoading: boolean;
  chatLoadingOlder: boolean;
  hasMoreMessages: boolean;
  onLoadOlder: () => void;
  messages: ChatMessage[];
  streamingContent: string | null;
  agentStatus: string | null;
  lookingUp: boolean;
  busy: boolean;
  welcomeContent: string | null;
  rateCards: RateCard[];
  stayNotes: TripBuilderStayNotes | null;
  offersDisabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [prevChatLoading, setPrevChatLoading] = useState(chatLoading);
  const scrollAdjustRef = useRef<number | null>(null);
  const olderFetchLockRef = useRef(false);

  if (chatLoading !== prevChatLoading) {
    setPrevChatLoading(chatLoading);
    if (chatLoading) setShowJump(false);
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || chatLoading) return;

    if (scrollAdjustRef.current != null) {
      el.scrollTop = el.scrollHeight - scrollAdjustRef.current;
      scrollAdjustRef.current = null;
      return;
    }

    if (stickToBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [messages, streamingContent, agentStatus, busy, chatLoading, welcomeContent, rateCards]);

  useEffect(() => {
    if (chatLoading) {
      stickToBottomRef.current = true;
    }
  }, [chatLoading]);

  useEffect(() => {
    if (!chatLoadingOlder) {
      olderFetchLockRef.current = false;
    }
  }, [chatLoadingOlder]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
    const jumpThreshold = Math.max(280, Math.min(el.clientHeight * 0.6, 520));
    const show = distanceFromBottom >= jumpThreshold;
    setShowJump((current) => (current === show ? current : show));

    if (
      el.scrollTop < 72 &&
      hasMoreMessages &&
      !olderFetchLockRef.current &&
      !chatLoading
    ) {
      olderFetchLockRef.current = true;
      scrollAdjustRef.current = el.scrollHeight - el.scrollTop;
      onLoadOlder();
    }
  }

  function jumpToLatest() {
    stickToBottomRef.current = true;
    setShowJump(false);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-3 pb-3 sm:px-6 sm:pt-4"
      >
      {banner}

      {chatLoading ? (
        <ChatSkeleton />
      ) : (
        <ChatMessageList
          messages={messages}
          streamingContent={streamingContent}
          agentStatus={agentStatus}
          lookingUp={lookingUp}
          busy={busy}
          loadingOlder={chatLoadingOlder}
          welcomeContent={welcomeContent}
          rateCards={rateCards}
          stayNotes={stayNotes}
          offersDisabled={offersDisabled}
          endRef={endRef}
        />
      )}
    </div>
      <button
        type="button"
        onClick={jumpToLatest}
        aria-label="Jump to latest messages"
        aria-hidden={showJump ? undefined : true}
        tabIndex={showJump ? 0 : -1}
        className={cn(
          "absolute bottom-4 left-1/2 z-10 grid h-11 w-11 -translate-x-1/2 place-items-center rounded-full lg:h-8 lg:w-8",
          "bg-surface-raised text-ink ring-1 ring-border",
          "shadow-md transition-opacity duration-200",
          "hover:bg-surface-hover hover:ring-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong",
          showJump ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <LuArrowDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

function stageCueFor(
  detail: TripDetail,
  stage: ReturnType<typeof resolveTripStage>,
  activeLegId: string | null,
): string {
  if (stage === "client" && detail.client && !detail.trip.travellers_confirmed_at) {
    const name = detail.client.display_name;
    return `**${name}** is the lead. Who else is traveling? Add a client, or say **just them**.`;
  }
  if (stage === "client") {
    return "Ask about a client anytime. To add someone, say who — a confirm chip appears before they are assigned.";
  }
  if (stage === "stay" && !detail.trip.starts_on) {
    const name = detail.client?.display_name;
    const who = name ? `This trip is for **${name}**. ` : "";
    return `${who}First, set the trip start and end. Every stay has to sit inside those days. Hotel check-in and check-out come later, on each stay.\n\nStart: 2026-10-10\nEnd: 2026-10-20`;
  }
  if (stage === "stay" && !detail.trip.legs_confirmed_at) {
    return `Trip dates are **${detail.trip.starts_on}** to **${detail.trip.ends_on}**.\n\nList each stay inside those dates:\n\nCity: Maldives\nCheck-in: ${detail.trip.starts_on}\nCheck-out: ${detail.trip.ends_on}\n\nA city on its own uses the full trip for the first stay. When the list is complete, tap **Plan these stays**.`;
  }
  if (stage === "stay") {
    const open =
      detail.stays.find((stay) => stay.leg_id === activeLegId) ??
      detail.stays[0] ??
      detail.stay;
    const lead = open?.city
      ? `Plan **${open.city}** (${open.check_in} to ${open.check_out}). Switch stays from the row under the header. You can add a stay, change one, or change the trip dates in chat.`
      : "This trip needs a stay.";
    return stayAskText(lead);
  }
  if (stage === "rates") {
    const open =
      detail.stays.find((stay) => stay.leg_id === activeLegId) ??
      detail.stays[0] ??
      detail.stay;
    const hotel = open?.property_name?.trim();
    return hotel
      ? `Stay set for ${hotel}. Ask me to search rates, or paste a supplier quote. I'll confirm before I search. Switch stays from the row under the header. A date or hotel change clears the selected rate.`
      : "Ask me to search rates for the open stay, or paste a supplier quote. I'll confirm before I search.";
  }
  const status = detail.trip.status;
  if (status === "cancelled") return "This trip is cancelled. It is read-only.";
  if (status === "confirmed" || status === "completed") {
    return "This trip is confirmed. Bookings hold the stays. Open the trip page for the full journey.";
  }
  if (stage === "booking") {
    return "The client accepted the quote. Tap **Client chose this** on the room they picked for each stay. Then tap **Check availability** for today's price. If the hotel price changed, tap **Use today's cost**, and **Set client price** if the client price needs to change. Book with the hotel and confirm the booking in **Bookings**.";
  }
  if (status === "quote_sent" || status === "waiting_on_client") {
    return "The options quote is with the client. When they pick a room, tap **Client chose this**. When they agree, mark **Client accepted** on the trip page.";
  }
  return "Every stay has a room with a client price. Say **show the options quote** to check the PDF. When you send it, mark **Sent to client** on the trip page.";
}

function formatMsgTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ChatMessageList({
  messages,
  streamingContent,
  agentStatus,
  lookingUp,
  busy,
  loadingOlder,
  welcomeContent,
  rateCards,
  stayNotes,
  offersDisabled,
  endRef,
}: {
  messages: ChatMessage[];
  streamingContent: string | null;
  agentStatus: string | null;
  /** Text already streamed, and the agent went back to look something up. */
  lookingUp: boolean;
  busy: boolean;
  loadingOlder: boolean;
  welcomeContent: string | null;
  rateCards: RateCard[];
  stayNotes: TripBuilderStayNotes | null;
  offersDisabled: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  const showWelcome =
    Boolean(welcomeContent) &&
    messages.length === 0 &&
    streamingContent == null;

  if (!showWelcome && messages.length === 0 && streamingContent == null && !busy) {
    return null;
  }

  const showPhaseOnly =
    streamingContent != null &&
    streamingContent.length === 0 &&
    Boolean(agentStatus);
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const offers =
    rateCards.length > 0 ? (
      <MessageOffers rateCards={rateCards} stayNotes={stayNotes} disabled={offersDisabled} />
    ) : null;

  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4" aria-live="polite">
      {loadingOlder ? (
        <p className="py-1 text-center text-[12px] text-ink-muted">
          Loading earlier messages…
        </p>
      ) : null}
      {showWelcome && welcomeContent ? (
        <AgentMessage time="" content={welcomeContent} offers={offers} />
      ) : null}
      {messages.map((message) =>
        message.role === "assistant" ? (
          <AgentMessage
            key={message.id}
            time={formatMsgTime(message.created_at)}
            incomplete={message.incomplete}
            content={message.content}
            offers={message.id === lastAssistantId ? offers : null}
          />
        ) : message.kind === "action" ? (
          <YouTapped key={message.id} time={formatMsgTime(message.created_at)}>
            {message.content}
          </YouTapped>
        ) : (
          <YouMessage key={message.id} time={formatMsgTime(message.created_at)}>
            {message.content}
          </YouMessage>
        ),
      )}
      {!showWelcome && !lastAssistantId && offers ? (
        <AgentMessage time="" content="" offers={offers} />
      ) : null}
      {streamingContent != null ? (
        <AgentMessage
          time="now"
          content={streamingContent}
          statusLabel={showPhaseOnly ? agentStatus : null}
          activityLabel={!showPhaseOnly && lookingUp ? agentStatus : null}
        />
      ) : busy ? (
        <AgentMessage
          time="now"
          content=""
          statusLabel={AGENT_PHASE_LABEL.thinking}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

function AgentStatusLabel({ label }: { label: string }) {
  const text = label.replace(/…$/, "");
  return (
    <p
      className="agent-phase-label inline-flex items-center gap-0.5 py-0.5 text-[13px] font-medium text-accent-ink"
      aria-live="polite"
      aria-label={label}
    >
      {text}
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="animate-pulse">.</span>
        <span className="animate-pulse [animation-delay:150ms]">.</span>
        <span className="animate-pulse [animation-delay:300ms]">.</span>
      </span>
    </p>
  );
}

function MessageOffers({
  rateCards,
  stayNotes,
  disabled,
}: {
  rateCards: RateCard[];
  stayNotes: TripBuilderStayNotes | null;
  disabled: boolean;
}) {
  const recommended = rateCards.filter((card) => card.recommended);
  const others = rateCards.filter((card) => !card.recommended);
  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {stayNotes ? <TripBuilderStayNotesCard notes={stayNotes} /> : null}
      {recommended.map((card) => (
        <TripBuilderRateCard key={card.id} card={card} disabled={disabled} />
      ))}
      {others.length > 0 && recommended.length > 0 ? (
        <p className="pt-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
          Other rates
        </p>
      ) : null}
      {others.map((card) => (
        <TripBuilderRateCard key={card.id} card={card} disabled={disabled} />
      ))}
    </div>
  );
}

function AgentMessage({
  content,
  time,
  incomplete,
  statusLabel,
  activityLabel,
  offers,
}: {
  content: string;
  time: string;
  incomplete?: boolean;
  /** Phase label while waiting for the first text delta. */
  statusLabel?: string | null;
  /** Lookup in progress after some text has already streamed. */
  activityLabel?: string | null;
  offers?: React.ReactNode;
}) {
  return (
    <div className="mr-auto flex w-full max-w-[min(100%,42rem)] items-start gap-2 self-start sm:gap-2.5">
      <AgentAvatar
        size="sm"
        thinking={Boolean(statusLabel) || (!content.trim() && !offers)}
        className="mt-4 sm:mt-5"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-ink">
          PureLuxe Agent
          {time ? (
            <span className="font-medium text-ink-muted">{time}</span>
          ) : null}
        </div>
        <div className="text-[14px] leading-relaxed break-words text-ink">
          {statusLabel ? (
            <AgentStatusLabel key={statusLabel} label={statusLabel} />
          ) : content.trim() ? (
            <ChatMarkdown content={content} />
          ) : offers ? null : (
            <AgentStatusLabel
              key={AGENT_PHASE_LABEL.thinking}
              label={AGENT_PHASE_LABEL.thinking}
            />
          )}
          {activityLabel ? <AgentStatusLabel key={activityLabel} label={activityLabel} /> : null}
          {incomplete ? (
            <p className="mt-2 text-[11px] text-ink-subtle">
              Reply was interrupted.
            </p>
          ) : null}
          {offers}
        </div>
      </div>
    </div>
  );
}

function YouMessage({
  children,
  time,
}: {
  children: React.ReactNode;
  time: string;
}) {
  return (
    <div className="ml-auto w-full max-w-[min(88%,42rem)] self-end sm:max-w-[min(100%,42rem)]">
      <div className="mb-1 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-ink">
        You
        {time ? (
          <span className="font-medium text-ink-muted">{time}</span>
        ) : null}
      </div>
      <div className="rounded-[14px] rounded-tr-sm border border-neutral-line bg-neutral-soft px-3 py-2.5 text-[14px] leading-relaxed break-words text-ink sm:px-3.5">
        <p className="whitespace-pre-wrap">{children}</p>
      </div>
    </div>
  );
}

/** A button tap: a quiet line, not a chat bubble, so it never reads as typed text. */
function YouTapped({
  children,
  time,
}: {
  children: React.ReactNode;
  time: string;
}) {
  return (
    <p className="ml-auto max-w-[min(88%,42rem)] self-end text-right text-[12px] leading-snug break-words text-ink-subtle">
      <span className="sr-only">You tapped: </span>
      {children}
      {time ? <span className="ml-1.5">· {time}</span> : null}
    </p>
  );
}
