"use client";

import { useEffect, useRef, useState } from "react";
import { LuArrowUp } from "react-icons/lu";

import { studioButtonClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import {
  TripBuilderActionChip,
  type TripBuilderChip,
} from "./trip-builder-action-chip";

type TripBuilderComposerProps = {
  placeholder: string;
  helperText?: string;
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
  chips = [],
  disabled,
  streaming = false,
  onSend,
}: TripBuilderComposerProps) {
  const [value, setValue] = useState("");
  const [runningChipId, setRunningChipId] = useState<string | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const chipSet = chips.map((chip) => chip.id).join("|");
  const folded = chips.length > VISIBLE_CHIPS + 1 && expandedFor !== chipSet;
  const visibleChips: TripBuilderChip[] = folded
    ? [
        ...chips.slice(0, VISIBLE_CHIPS),
        {
          id: "more-chips",
          label: `More (${chips.length - VISIBLE_CHIPS})`,
          onClick: () => setExpandedFor(chipSet),
        },
      ]
    : chips;

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
  const showHelper = !streaming && Boolean(helperText);

  return (
    <div className="shrink-0 border-t border-border bg-surface-raised px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2">
      {showChips ? (
        <div
          className={cn(
            "mb-1.5 flex flex-wrap gap-1.5",
            "lg:mb-2 lg:flex-nowrap lg:gap-2 lg:overflow-x-auto lg:pb-0.5",
            "lg:[-ms-overflow-style:none] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden",
          )}
        >
          {visibleChips.map((chip) => (
            <div key={chip.id} className="max-w-full lg:shrink-0">
              <TripBuilderActionChip
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
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 focus-within:border-brand-dark/30 focus-within:ring-1 focus-within:ring-brand-dark/10">
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
            "placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-60",
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
      {showHelper ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-ink-subtle sm:line-clamp-none">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
