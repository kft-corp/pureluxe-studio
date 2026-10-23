"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuArrowDown, LuSparkles } from "react-icons/lu";

import { AGENT_PHASE_LABEL, type AgentPhase } from "@pureluxe/ai/chat-stream";

import type { ChatMessage, TripDetail } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { ChatMarkdown } from "./chat-markdown";
import { resolveTripStage } from "./stages";
import { TRIP_START_PROMPT } from "./trip-builder-copy";
import {
  TripBuilderRateCard,
  TripBuilderStayNotesCard,
  type TripBuilderRateCard as RateCard,
  type TripBuilderStayNotes,
} from "./trip-builder-rate-card";
import { CHAT_COLUMN_CLASS } from "./trip-builder-helpers";
import { ChatSkeleton } from "./trip-builder-skeleton";

/** How long "Jump to latest" stays after the advisor stops scrolling. */
const JUMP_VISIBLE_MS = 2500;

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
  /** This reply's steps so far, e.g. "Finding the client…". */
  agentSteps: string[];
  rateCards: RateCard[];
  stayNotes: TripBuilderStayNotes | null;
  activeLegId?: string | null;
  onLoadOlder: () => void;
};

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
  agentSteps,
  rateCards,
  stayNotes,
  activeLegId = null,
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
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
          <AgentAvatar />
          <h2 className="mt-4 font-serif text-[1.6rem] leading-tight font-medium tracking-tight text-ink sm:text-[1.9rem]">
            Where to next?
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            {canWrite
              ? "Tell me who the trip is for, where and when, or ask about a client, hotel or place."
              : "Ask about a client, hotel or place, or open one of your trips above."}
          </p>
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
      agentPhase={agentPhase}
      agentSteps={agentSteps}
      busy={busy}
      welcomeContent={
        detail && showWelcome
          ? tripWelcomeMessage(detail, resolveTripStage(detail), activeLegId)
          : null
      }
      rateCards={streamingContent ? [] : rateCards}
      stayNotes={streamingContent ? null : stayNotes}
      offersDisabled={busy}
    />
  );
}

function tripWelcomeMessage(
  detail: TripDetail,
  stage: ReturnType<typeof resolveTripStage>,
  activeLegId: string | null,
): string {
  if (stage === "client" && !detail.client) return TRIP_START_PROMPT;
  return stageCueFor(detail, stage, activeLegId);
}

/** The agent's mark on the empty start screen. */
function AgentAvatar() {
  return (
    <div
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-avatar-hero text-avatar-hero-ink shadow-sm ring-1 ring-inset ring-accent/40"
    >
      <LuSparkles className="h-4 w-4" strokeWidth={1.75} />
    </div>
  );
}

function ChatScrollArea({
  chatLoading,
  chatLoadingOlder,
  hasMoreMessages,
  onLoadOlder,
  messages,
  streamingContent,
  agentPhase,
  agentSteps,
  busy,
  welcomeContent,
  rateCards,
  stayNotes,
  offersDisabled,
}: {
  chatLoading: boolean;
  chatLoadingOlder: boolean;
  hasMoreMessages: boolean;
  onLoadOlder: () => void;
  messages: ChatMessage[];
  streamingContent: string | null;
  agentPhase: AgentPhase | null;
  agentSteps: string[];
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
  const jumpTimerRef = useRef<number | null>(null);
  /** Pointer or keyboard focus is on the button, so it stays visible. */
  const jumpHeldRef = useRef(false);

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
  }, [messages, streamingContent, agentPhase, agentSteps, busy, chatLoading, welcomeContent, rateCards]);

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

  useEffect(() => () => clearJumpTimer(), []);

  function clearJumpTimer() {
    if (jumpTimerRef.current != null) window.clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = null;
  }

  /** Hide the button after a pause in scrolling, unless the pointer or focus is on it. */
  function scheduleJumpHide() {
    clearJumpTimer();
    if (jumpHeldRef.current) return;
    jumpTimerRef.current = window.setTimeout(() => setShowJump(false), JUMP_VISIBLE_MS);
  }

  function holdJump(held: boolean) {
    jumpHeldRef.current = held;
    if (held) clearJumpTimer();
    else scheduleJumpHide();
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
    const jumpThreshold = Math.max(280, Math.min(el.clientHeight * 0.6, 520));
    if (distanceFromBottom >= jumpThreshold) {
      setShowJump(true);
      scheduleJumpHide();
    } else {
      clearJumpTimer();
      setShowJump(false);
    }

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
    clearJumpTimer();
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
      {chatLoading ? (
        <div className={CHAT_COLUMN_CLASS}>
          <ChatSkeleton />
        </div>
      ) : (
        <ChatMessageList
          messages={messages}
          streamingContent={streamingContent}
          agentPhase={agentPhase}
          agentSteps={agentSteps}
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
        onPointerEnter={() => holdJump(true)}
        onPointerLeave={() => holdJump(false)}
        onFocus={() => holdJump(true)}
        onBlur={() => holdJump(false)}
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
  if (stage === "client") {
    const name = detail.client?.display_name;
    return `${name ? `**${name}** is the lead. ` : ""}Tell me who else is travelling, and where and when.`;
  }
  if (stage === "stay" && !detail.trip.legs_confirmed_at) {
    const name = detail.client?.display_name;
    const dates = detail.trip.starts_on
      ? `The trip runs **${detail.trip.starts_on}** to **${detail.trip.ends_on}**. `
      : "";
    return `${name ? `This trip is for **${name}**. ` : ""}${dates}Tell me where they're staying, with dates for each stay if there is more than one.`;
  }
  if (stage === "stay") {
    const open =
      detail.stays.find((stay) => stay.leg_id === activeLegId) ??
      detail.stays[0] ??
      detail.stay;
    return open?.city
      ? `Which hotel for **${open.city}** (${open.check_in} to ${open.check_out})? Name one, or ask for suggestions. Switch stays from the row under the header.`
      : "Tell me where they're staying.";
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
  agentPhase,
  agentSteps,
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
  agentPhase: AgentPhase | null;
  agentSteps: string[];
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

  const lookingUp = agentPhase === "looking_up" && agentSteps.length > 0;
  /** Before any text: the phase ("Thinking…"), unless a lookup is shimmering in the steps. */
  const phaseLabel =
    streamingContent === "" && !lookingUp ? AGENT_PHASE_LABEL[agentPhase ?? "thinking"] : null;
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;
  const offers =
    rateCards.length > 0 ? (
      <MessageOffers rateCards={rateCards} stayNotes={stayNotes} disabled={offersDisabled} />
    ) : null;

  return (
    <div className={cn("flex flex-col gap-4 sm:gap-5", CHAT_COLUMN_CLASS)} aria-live="polite">
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
          steps={agentSteps}
          lookingUp={lookingUp}
          statusLabel={phaseLabel}
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
  return (
    <p className="agent-phase-label py-0.5 text-[13px] font-medium text-accent-ink" aria-live="polite">
      <span className="agent-phase-shimmer">{label}</span>
    </p>
  );
}

/** This reply's steps, one per line in order; the one still running shimmers. */
function AgentSteps({ steps, lookingUp }: { steps: string[]; lookingUp: boolean }) {
  return (
    <ol className="mb-2 space-y-0.5" aria-label="What the agent is doing">
      {steps.map((step, index) => {
        const running = lookingUp && index === steps.length - 1;
        return (
          <li key={step} className="agent-phase-label text-[13px] leading-5 text-ink-muted">
            {running ? <span className="agent-phase-shimmer font-medium">{step}</span> : step.replace(/…$/, "")}
          </li>
        );
      })}
    </ol>
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
  steps = [],
  lookingUp = false,
  statusLabel,
  offers,
}: {
  content: string;
  time: string;
  incomplete?: boolean;
  /** Lookups made while this reply was written (live replies only). */
  steps?: string[];
  /** The last step is still running. */
  lookingUp?: boolean;
  /** Phase label while waiting for the first text delta. */
  statusLabel?: string | null;
  offers?: React.ReactNode;
}) {
  return (
    <div
      className="w-full self-start text-[15px] leading-[1.6] break-words text-ink"
      title={timeTooltip(time)}
    >
      <span className="sr-only">PureLuxe Agent: </span>
      {steps.length > 0 ? <AgentSteps steps={steps} lookingUp={lookingUp} /> : null}
      {statusLabel ? (
        <AgentStatusLabel key={statusLabel} label={statusLabel} />
      ) : content.trim() ? (
        <ChatMarkdown content={content} />
      ) : offers || lookingUp ? null : (
        <AgentStatusLabel key={AGENT_PHASE_LABEL.thinking} label={AGENT_PHASE_LABEL.thinking} />
      )}
      {incomplete ? <p className="mt-2 text-[11px] text-ink-subtle">Reply was interrupted.</p> : null}
      {offers}
    </div>
  );
}

/** Message times show on hover only, so the thread stays content first. */
function timeTooltip(time: string): string | undefined {
  return time && time !== "now" ? time : undefined;
}

function YouMessage({
  children,
  time,
}: {
  children: React.ReactNode;
  time: string;
}) {
  return (
    <div className="ml-auto flex max-w-[85%] justify-end self-end" title={timeTooltip(time)}>
      <div className="w-fit rounded-[14px] rounded-tr-sm border border-neutral-line bg-neutral-soft px-3 py-2.5 text-[14.5px] leading-relaxed break-words text-ink sm:px-3.5">
        <span className="sr-only">You: </span>
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
    <p
      className="ml-auto max-w-[85%] self-end text-right text-[12px] leading-snug break-words text-ink-subtle"
      title={timeTooltip(time)}
    >
      <span className="sr-only">You tapped: </span>
      {children}
    </p>
  );
}
