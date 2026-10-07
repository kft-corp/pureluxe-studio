"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { LuBotMessageSquare } from "react-icons/lu";

import { AGENT_PHASE_LABEL, type AgentPhase } from "@pureluxe/ai";

import { studioButtonClass } from "@/components/ui";
import type { ChatMessage, TripDetail } from "@/lib/trip-builder";
import { cn } from "@/lib/utils/cn";

import { ChatMarkdown } from "./chat-markdown";
import { resolveTripStage } from "./stages";
import type { TripBuilderChip } from "./trip-builder-action-chip";

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
  homeChips: TripBuilderChip[];
  onCreateTrip: () => void;
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
  homeChips,
  onCreateTrip,
  onLoadOlder,
}: TripBuilderChatPaneProps) {
  const hasDraftThread =
    !detail && (messages.length > 0 || streamingContent != null);

  if (chatLoading && !detail) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col px-4 pt-4 pb-3 sm:px-6">
        <ChatLoadingState />
      </div>
    );
  }

  if (!detail && !hasDraftThread) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col justify-center px-4 py-8 text-center sm:py-16">
        <h2 className="font-serif text-[1.65rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.05rem]">
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
                    "inline-flex h-9 items-center rounded-full bg-[#faf9f7] px-3.5 text-[13px] font-medium leading-none text-ink ring-1 ring-border transition-colors sm:h-7 sm:px-3",
                    "hover:bg-[#e8f2ee]/90 hover:text-[#1a4d3e] hover:ring-[#1a4d3e]/25",
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
      welcomeContent={
        detail && showWelcome
          ? tripWelcomeMessage(detail, resolveTripStage(detail))
          : null
      }
      banner={<AgentStatusBanner detail={detail} />}
    />
  );
}

function tripWelcomeMessage(
  detail: TripDetail,
  stage: ReturnType<typeof resolveTripStage>,
): string {
  return `I'm your **PureLuxe agent**. I'll help you build this trip step by step — **client → stay → rates → quote**.\n\nUse chips to confirm actions. ${stageCueFor(detail, stage)}`;
}

function AgentStatusBanner({ detail }: { detail: TripDetail | null }) {
  return (
    <div className="mb-3 flex w-full items-start gap-2.5 rounded-xl border border-[#d5e8df] bg-[#e8f2ee] px-3 py-2.5 sm:mb-4">
      <div
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1a4d3e] text-white"
        aria-hidden
      >
        <LuBotMessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#1a4d3e]">
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
  agentPhase,
  welcomeContent,
}: {
  banner: React.ReactNode;
  chatLoading: boolean;
  chatLoadingOlder: boolean;
  hasMoreMessages: boolean;
  onLoadOlder: () => void;
  messages: ChatMessage[];
  streamingContent: string | null;
  agentPhase: AgentPhase | null;
  welcomeContent: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollAdjustRef = useRef<number | null>(null);
  const olderFetchLockRef = useRef(false);

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
  }, [messages, streamingContent, agentPhase, chatLoading, welcomeContent]);

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

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-3 pb-3 sm:px-6 sm:pt-4"
    >
      {banner}

      {chatLoading ? (
        <ChatLoadingState />
      ) : (
        <ChatMessageList
          messages={messages}
          streamingContent={streamingContent}
          agentPhase={agentPhase}
          loadingOlder={chatLoadingOlder}
          welcomeContent={welcomeContent}
          endRef={endRef}
        />
      )}
    </div>
  );
}

function ChatLoadingState() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-2 py-16"
      aria-busy
      aria-live="polite"
    >
      <p className="text-[13px] font-medium text-[#1a4d3e]">Loading chat</p>
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1a4d3e]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1a4d3e] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1a4d3e] [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function stageCueFor(
  detail: TripDetail,
  stage: ReturnType<typeof resolveTripStage>,
): string {
  if (stage === "client") {
    return "Type the client name below. Matching clients appear as chips — tap one to assign.";
  }
  if (stage === "stay") {
    const name = detail.client?.display_name;
    return name
      ? `Client set — ${name}. Type hotel, city, and dates (YYYY-MM-DD), then tap Save stay.`
      : "Type hotel, city, and dates (YYYY-MM-DD), then tap Save stay.";
  }
  if (stage === "rates") {
    return `Stay set for ${detail.stay?.property_name}. Tap Search rates, pick a rate chip, or paste a supplier quote.`;
  }
  if (stage === "quote") {
    return "Quote PDF is ready. Ask me to summarize, or tap Open PDF.";
  }
  return "Rate selected. Ask for wording help, set sell (e.g. sell 4500 USD), then tap Generate PDF.";
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
  loadingOlder,
  welcomeContent,
  endRef,
}: {
  messages: ChatMessage[];
  streamingContent: string | null;
  agentPhase: AgentPhase | null;
  loadingOlder: boolean;
  welcomeContent: string | null;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  const showWelcome =
    Boolean(welcomeContent) &&
    messages.length === 0 &&
    streamingContent == null;

  if (!showWelcome && messages.length === 0 && streamingContent == null) {
    return null;
  }

  const phaseLabel = agentPhase ? AGENT_PHASE_LABEL[agentPhase] : null;
  const showPhaseOnly =
    streamingContent != null &&
    streamingContent.length === 0 &&
    Boolean(phaseLabel);

  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4" aria-live="polite">
      {loadingOlder ? (
        <p className="py-1 text-center text-[12px] text-ink-muted">
          Loading earlier messages…
        </p>
      ) : null}
      {showWelcome && welcomeContent ? (
        <AgentMessage time="" content={welcomeContent} />
      ) : null}
      {messages.map((message) =>
        message.role === "assistant" ? (
          <AgentMessage
            key={message.id}
            time={formatMsgTime(message.created_at)}
            incomplete={message.incomplete}
            content={message.content}
          />
        ) : (
          <YouMessage key={message.id} time={formatMsgTime(message.created_at)}>
            {message.content}
          </YouMessage>
        ),
      )}
      {streamingContent != null ? (
        <AgentMessage
          time="now"
          content={streamingContent}
          statusLabel={showPhaseOnly ? phaseLabel : null}
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
      className="agent-phase-label inline-flex items-center gap-0.5 py-0.5 text-[13px] font-medium text-[#1a4d3e]"
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

function AgentMessage({
  content,
  time,
  incomplete,
  statusLabel,
}: {
  content: string;
  time: string;
  incomplete?: boolean;
  /** Phase label while waiting for the first text delta. */
  statusLabel?: string | null;
}) {
  return (
    <div className="mr-auto flex w-full max-w-[min(100%,42rem)] items-start gap-2 self-start sm:gap-2.5">
      <div
        className="mt-4 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1a4d3e] text-white sm:mt-5 sm:h-8 sm:w-8"
        aria-hidden
      >
        <LuBotMessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
      </div>
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
          ) : (
            <AgentStatusLabel
              key={AGENT_PHASE_LABEL.thinking}
              label={AGENT_PHASE_LABEL.thinking}
            />
          )}
          {incomplete ? (
            <p className="mt-2 text-[11px] text-ink-subtle">
              Reply was interrupted.
            </p>
          ) : null}
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
      <div className="rounded-[14px] rounded-tr-sm border border-[#ddd6c8] bg-brand-light px-3 py-2.5 text-[14px] leading-relaxed break-words text-ink sm:px-3.5">
        <p className="whitespace-pre-wrap">{children}</p>
      </div>
    </div>
  );
}
