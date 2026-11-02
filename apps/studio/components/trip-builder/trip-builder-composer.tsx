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
  /** Messages waiting to send after the current reply. */
  queuedCount?: number;
  chips?: TripBuilderChip[];
  disabled?: boolean;
  /** When true, hide chips and the helper — typing status lives in the thread only. */
  streaming?: boolean;
  onSend: (text: string) => void;
};

/** Chat composer — prior input control (textarea + arrow send). Undo is the only chip. */
export function TripBuilderComposer({
  placeholder,
  helperText = "Type in chat — say Confirm or Cancel when asked.",
  notice,
  queuedCount = 0,
  chips = [],
  disabled,
  streaming = false,
  onSend,
}: TripBuilderComposerProps) {
  const [value, setValue] = useState("");
  const [runningChipId, setRunningChipId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const undo = chips.filter((chip) => chip.kind === "undo");

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

  const showChips = !streaming && undo.length > 0;
  const helper = notice ?? (streaming ? undefined : helperText);

  return (
    <div className="shrink-0 border-t border-border/50 bg-transparent px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-3">
      <div className={CHAT_COLUMN_CLASS}>
        {showChips ? (
          <div className="mb-2 flex flex-col gap-1.5">
            <div className="flex">{undo.map(renderChip)}</div>
          </div>
        ) : null}

        <div className="flex items-end gap-1.5 rounded-2xl border border-border/70 bg-surface-raised px-3 py-2 shadow-[0_12px_36px_rgba(22,26,31,0.08)] ring-1 ring-white/60 transition hover:border-border-strong focus-within:border-accent-strong focus-within:ring-2 focus-within:ring-accent/25">
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
          {queuedCount > 0 ? (
            <span
              className="mb-1.5 inline-flex shrink-0 items-center rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-medium text-info-ink ring-1 ring-inset ring-info-line lg:mb-0.5"
              title={notice ?? "Message queued"}
            >
              Queued{queuedCount > 1 ? ` · ${queuedCount}` : ""}
            </span>
          ) : null}
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
            className={cn(
              "mt-1.5 line-clamp-2 text-[12px] leading-snug sm:line-clamp-none",
              notice ? "text-ink-muted" : "text-ink-subtle",
            )}
            aria-live={notice ? "polite" : undefined}
          >
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}
