"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuArrowDown, LuCheck, LuCopy } from "react-icons/lu";

import {
  AGENT_PHASE_LABEL,
  type AgentPhase,
  type RateCompareCard,
} from "@pureluxe/ai/chat-stream";

import { tripMessages } from "@pureluxe/shared";

import { studioFocusRing } from "@/components/ui";
import { showWarningToast } from "@/lib/feedback";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { AgentSparkle } from "./agent-sparkle";
import { ChatMarkdown } from "./chat-markdown";
import { resolveTripStage, staysAwaitingRoom } from "./stages";
import { BOOKING_PREP_GUIDE, TRIP_START_PROMPT } from "./trip-builder-copy";
import { TripBuilderLegSplit } from "./trip-builder-leg-split";
import {
  TripBuilderRateCard,
  TripBuilderStayNotesCard,
  type TripBuilderRateCard as RateCard,
  type TripBuilderStayNotes,
} from "./trip-builder-rate-card";
import {
  TripBuilderRateCompare,
  type RateCompareAddOption,
} from "./trip-builder-rate-compare";
import { CHAT_COLUMN_CLASS, chatDayKey, chatDayLabel, plainReplyText } from "./trip-builder-helpers";
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
  rateCompare?: RateCompareCard | null;
  stayNotes: TripBuilderStayNotes | null;
  activeLegId?: string | null;
  onLoadOlder: () => void;
  /** Add a room from the compare card (Stage 3d). */
  onAddRateOption?: (option: RateCompareAddOption) => void;
  /** Resume an incomplete assistant reply from the checkpointer. */
  onContinueIncomplete?: () => void;
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
  rateCompare = null,
  stayNotes,
  activeLegId = null,
  onLoadOlder,
  onAddRateOption,
  onContinueIncomplete,
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
      rateCompare={streamingContent ? null : rateCompare}
      stayNotes={streamingContent ? null : stayNotes}
      offersDisabled={busy}
      onAddRateOption={canWrite ? onAddRateOption : undefined}
      onContinueIncomplete={canWrite && !busy ? onContinueIncomplete : undefined}
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
  return <AgentSparkle className="h-7 w-7" />;
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
  rateCompare,
  stayNotes,
  offersDisabled,
  onAddRateOption,
  onContinueIncomplete,
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
  rateCompare: RateCompareCard | null;
  stayNotes: TripBuilderStayNotes | null;
  offersDisabled: boolean;
  onAddRateOption?: (option: RateCompareAddOption) => void;
  onContinueIncomplete?: () => void;
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
          rateCompare={rateCompare}
          stayNotes={stayNotes}
          offersDisabled={offersDisabled}
          onAddRateOption={onAddRateOption}
          onContinueIncomplete={onContinueIncomplete}
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
      ? `Which hotel for **${open.city}** (${open.check_in} to ${open.check_out})? Name one, ask for suggestions, or say **suggest 3 and get rates**. Switch stays from the row under the header.`
      : "Tell me where they're staying.";
  }
  if (stage === "rates") {
    const open =
      detail.stays.find((stay) => stay.leg_id === activeLegId) ??
      detail.stays[0] ??
      detail.stay;
    const hotel = open?.property_name?.trim();
    const place = open?.city?.trim();
    if (hotel) {
      return `**${hotel}** is on the trip. Ask for rates or more hotels to compare — I'll search at once and show a compare card. Or paste a supplier quote. Switch stays from the row under the header.`;
    }
    if (place) {
      return `Dates are set for **${place}**. Name hotels, ask for suggestions, or say **suggest 3 and get rates** — I'll search without needing a saved stay first.`;
    }
    return "Name hotels or ask for suggestions for the trip dates — I'll search rates at once (no stay save needed). Or paste a supplier quote.";
  }
  const status = detail.trip.status;
  if (status === "cancelled") return "This trip is cancelled. It is read-only.";
  if (status === "confirmed" || status === "completed") {
    return "This trip is confirmed. Bookings hold the stays. Open the trip page for the full journey.";
  }
  if (stage === "booking") {
    if (staysAwaitingRoom(detail) > 0) {
      return "Client said yes. Tap **This is their room** for each stay. Then check today's price, book offline, confirm the hotel in **Bookings** with the PNR, and clear travel prep.";
    }
    return BOOKING_PREP_GUIDE;
  }
  if (status === "quote_sent" || status === "waiting_on_client") {
    return "The quote is with the client. When they agree, mark **Client said yes** on the trip page, then tap **This is their room** here.";
  }
  return "Every stay has a room with a client price. Say **show the options quote** to check the PDF. When you send it, mark **Sent to client** on the trip page.";
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
  rateCompare,
  stayNotes,
  offersDisabled,
  onAddRateOption,
  onContinueIncomplete,
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
  rateCompare: RateCompareCard | null;
  stayNotes: TripBuilderStayNotes | null;
  offersDisabled: boolean;
  onAddRateOption?: (option: RateCompareAddOption) => void;
  onContinueIncomplete?: () => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  const showWelcome =
    Boolean(welcomeContent) &&
    messages.length === 0 &&
    streamingContent == null;

  if (!showWelcome && messages.length === 0 && streamingContent == null && !busy) {
    return null;
  }

  /** The live line: the latest step while the agent looks something up, else the phase until the first words. */
  const liveStatus =
    agentPhase === "looking_up" && agentSteps.length > 0
      ? agentSteps.at(-1)!
      : streamingContent === ""
        ? AGENT_PHASE_LABEL[agentPhase ?? "thinking"]
        : null;
  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.id;

  /** Rate / split cards are stored on the message so they stay after later replies. */
  function offersForMessage(message: ChatMessage, isLastAssistant: boolean): React.ReactNode {
    const savedCompare = message.cards?.rateCompare ?? null;
    const savedSplit = message.cards?.legSplit ?? null;
    if (savedCompare || savedSplit) {
      return (
        <>
          {savedCompare ? (
            <TripBuilderRateCompare
              compare={savedCompare}
              disabled={offersDisabled}
              onAddOption={onAddRateOption}
            />
          ) : null}
          {savedSplit ? <TripBuilderLegSplit split={savedSplit} /> : null}
        </>
      );
    }
    // Live fallback: last reply only, when cards were not on the row yet / legacy rate cards.
    if (!isLastAssistant) return null;
    if (rateCompare != null) {
      return (
        <TripBuilderRateCompare
          compare={rateCompare}
          disabled={offersDisabled}
          onAddOption={onAddRateOption}
        />
      );
    }
    if (rateCards.length > 0) {
      return (
        <MessageOffers rateCards={rateCards} stayNotes={stayNotes} disabled={offersDisabled} />
      );
    }
    return null;
  }

  const welcomeOffers =
    rateCompare != null ? (
      <TripBuilderRateCompare
        compare={rateCompare}
        disabled={offersDisabled}
        onAddOption={onAddRateOption}
      />
    ) : rateCards.length > 0 ? (
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
        <AgentMessage content={welcomeContent} offers={welcomeOffers} />
      ) : null}
      {messages.map((message, index) => {
        const day = chatDayKey(message.created_at);
        const newDay = day !== null && day !== chatDayKey(messages[index - 1]?.created_at ?? "");
        const isLastAssistant = message.id === lastAssistantId;
        return (
          <Fragment key={message.id}>
            {newDay ? <DaySeparator label={chatDayLabel(message.created_at)} /> : null}
            {message.role === "assistant" ? (
              <AgentMessage
                incomplete={message.incomplete}
                content={message.content}
                offers={offersForMessage(message, isLastAssistant)}
                copyable
                onContinue={
                  message.incomplete && isLastAssistant && onContinueIncomplete
                    ? onContinueIncomplete
                    : undefined
                }
              />
            ) : message.kind === "action" ? (
              <YouTapped>{message.content}</YouTapped>
            ) : (
              <YouMessage>{message.content}</YouMessage>
            )}
          </Fragment>
        );
      })}
      {!showWelcome && !lastAssistantId && welcomeOffers ? (
        <AgentMessage content="" offers={welcomeOffers} />
      ) : null}
      {streamingContent != null ? (
        <AgentMessage content={streamingContent} status={liveStatus} />
      ) : busy ? (
        <AgentMessage content="" status={AGENT_PHASE_LABEL.thinking} />
      ) : null}
      <div ref={endRef} />
    </div>
  );
}

/** A quiet label where the conversation moves to a new day ("Today", "Mon 20 Oct"). */
function DaySeparator({ label }: { label: string }) {
  return (
    <div role="separator" aria-label={label} className="flex items-center gap-3 text-[12px] text-ink-muted">
      <span aria-hidden className="h-px flex-1 bg-divider" />
      <span>{label}</span>
      <span aria-hidden className="h-px flex-1 bg-divider" />
    </div>
  );
}

/** What the agent is doing, on one line that changes in place ("Thinking…" → "Finding the client…"). */
function AgentStatusLine({ label }: { label: string }) {
  return (
    <p className="agent-phase-label py-0.5 text-[13px] font-medium text-accent-ink" aria-live="polite">
      <span className="agent-phase-shimmer">{label}</span>
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
  incomplete,
  status,
  offers,
  copyable = false,
  onContinue,
}: {
  content: string;
  incomplete?: boolean;
  /** Live replies only: what the agent is doing now. */
  status?: string | null;
  offers?: React.ReactNode;
  /** A finished reply: show Copy under it. */
  copyable?: boolean;
  onContinue?: () => void;
}) {
  return (
    <div className="w-full self-start text-[15px] leading-[1.6] break-words text-ink">
      <span className="sr-only">Agent: </span>
      {content.trim() ? <ChatMarkdown content={content} /> : null}
      {status ? <AgentStatusLine key={status} label={status} /> : null}
      {incomplete ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-ink-subtle">
            Interrupted — tap Continue to pick up where we left off.
          </p>
          {onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className={cn(
                "rounded-md bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-ink ring-1 ring-inset ring-accent-line transition hover:bg-accent-soft/80",
                studioFocusRing,
              )}
            >
              {tripMessages.error.replyContinue}
            </button>
          ) : null}
        </div>
      ) : null}
      {offers}
      {copyable && content.trim() ? <CopyReplyButton content={content} /> : null}
    </div>
  );
}

/** Copies a reply as plain text, so it can go straight into a message to the client. */
function CopyReplyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainReplyText(content));
      setCopied(true);
    } catch {
      showWarningToast("Couldn't copy. Select the text and copy it instead.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Reply copied" : "Copy reply"}
      className={cn(
        "mt-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink",
        studioFocusRing,
      )}
    >
      {copied ? <LuCheck className="h-3.5 w-3.5" aria-hidden /> : <LuCopy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function YouMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto flex min-w-0 max-w-[min(85%,28rem)] justify-end self-end">
      <div className="w-fit min-w-0 max-w-full rounded-[14px] rounded-tr-sm border border-neutral-line bg-neutral-soft px-3 py-2.5 text-[14.5px] leading-relaxed break-words text-ink sm:px-3.5">
        <span className="sr-only">You: </span>
        <p className="whitespace-pre-wrap break-words">{children}</p>
      </div>
    </div>
  );
}

/** A button tap: a quiet line, not a chat bubble, so it never reads as typed text. */
function YouTapped({ children }: { children: React.ReactNode }) {
  return (
    <p className="ml-auto max-w-[85%] self-end text-right text-[12px] leading-snug break-words text-ink-subtle">
      <span className="sr-only">You tapped: </span>
      {children}
    </p>
  );
}
