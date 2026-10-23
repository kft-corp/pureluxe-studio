"use client";

import { useEffect, useRef, useState } from "react";
import { LuArrowUp } from "react-icons/lu";

import { studioButtonClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import {
  TripBuilderActionChip,
  type TripBuilderChip,
} from "./trip-builder-action-chip";
import { CHAT_COLUMN_CLASS } from "./trip-builder-helpers";

type TripBuilderComposerProps = {
  placeholder: string;
  helperText?: string;
  /** Shown in place of the helper, even while a reply streams (e.g. queued messages). */
  notice?: string;
  chips?: TripBuilderChip[];
  disabled?: boolean;
  /** When true, hide chips and the helper — typing status lives in the thread only. */
  streaming?: boolean;
  onSend: (text: string) => void;
};

/** Chips shown before the rest fold behind "More". */
const VISIBLE_CHIPS = 4;

/** Chat composer — prior input control (textarea + arrow send). */
export function TripBuilderComposer({
  placeholder,
  helperText = "Type in chat — confirm actions with chips. Rate cards stay on the reply.",
  notice,
  chips = [],
  disabled,
  streaming = false,
  onSend,
}: TripBuilderComposerProps) {
  const [value, setValue] = useState("");
  const [runningChipId, setRunningChipId] = useState<string | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const approval = chips.filter((chip) => chip.kind === "confirm" || chip.kind === "cancel");
  const choices = chips.filter((chip) => chip.kind === "choice");
  const undo = chips.filter((chip) => chip.kind === "undo");
  const ready = chips.filter((chip) => !chip.kind);

  const chipSet = ready.map((chip) => chip.id).join("|");
  const folded = ready.length > VISIBLE_CHIPS + 1 && expandedFor !== chipSet;
  const visibleReady: TripBuilderChip[] = folded
    ? [
        ...ready.slice(0, VISIBLE_CHIPS),
        {
          id: "more-chips",
          label: `More (${ready.length - VISIBLE_CHIPS})`,
          onClick: () => setExpandedFor(chipSet),
        },
      ]
    : ready;

  function renderChip(chip: TripBuilderChip) {
    return (
      <TripBuilderActionChip
        key={chip.id}
        chip={{
          ...chip,
          onClick: () => {
            setRunningChipId(chip.id);
            chip.onClick();
          },
        }}
        disabled={disabled}
        running={disabled && runningChipId === chip.id}
      />
    );
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setRunningChipId(null);
    onSend(text);
    setValue("");
  }

  const showChips = !streaming && chips.length > 0;
  const helper = notice ?? (streaming ? undefined : helperText);

  return (
    <div className="shrink-0 border-t border-border bg-surface-raised px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2">
      <div className={CHAT_COLUMN_CLASS}>
        {showChips ? (
          <div className="mb-2 flex flex-col gap-1.5">
            {approval.length > 0 ? (
              <div className="flex items-center gap-1">{approval.map(renderChip)}</div>
            ) : null}
            {choices.length > 0 ? (
              <div className="divide-y divide-divider overflow-hidden rounded-lg border border-border bg-surface-raised">
                {choices.map(renderChip)}
              </div>
            ) : null}
            {visibleReady.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">{visibleReady.map(renderChip)}</div>
            ) : null}
            {undo.length > 0 ? <div className="flex">{undo.map(renderChip)}</div> : null}
          </div>
        ) : null}

        <div className="flex items-end gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1 shadow-sm transition hover:border-border-strong focus-within:border-accent-strong focus-within:ring-2 focus-within:ring-accent/25">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            enterKeyHint="send"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            className={cn(
              "max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1.5 py-2 text-base leading-5 text-ink outline-none lg:min-h-8 lg:py-1.5 lg:text-[13px]",
              "placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <button
            type="button"
            disabled={disabled || !value.trim()}
            onClick={submit}
            aria-label="Send"
            className={studioButtonClass("primary", "sm", "h-11 w-11 shrink-0 !px-0 lg:h-8 lg:w-8")}
          >
            <LuArrowUp className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {helper ? (
          <p
            className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-ink-subtle sm:line-clamp-none"
            aria-live={notice ? "polite" : undefined}
          >
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}
