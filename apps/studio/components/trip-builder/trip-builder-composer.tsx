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
  /** When true, hide chips/helper — typing status lives in the thread only. */
  streaming?: boolean;
  onSend: (text: string) => void;
};

/** Chat composer — prior input control (textarea + arrow send). */
export function TripBuilderComposer({
  placeholder,
  helperText = "Type in chat — confirm actions with chips.",
  chips = [],
  disabled,
  streaming = false,
  onSend,
}: TripBuilderComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  const showChips = !streaming && chips.length > 0;
  const showHelper = !streaming && Boolean(helperText);

  return (
    <div className="shrink-0 border-t border-border bg-surface-raised px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2">
      {showChips ? (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <div key={chip.id} className="shrink-0">
              <TripBuilderActionChip chip={chip} disabled={disabled} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-1.5 rounded-xl border border-border bg-surface px-2 py-1.5 focus-within:border-brand-dark/30 focus-within:ring-1 focus-within:ring-brand-dark/10 sm:rounded-lg sm:py-1">
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
            "max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-2 text-base leading-5 text-ink outline-none sm:min-h-8 sm:py-1.5 sm:text-[13px]",
            "placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send"
          className={studioButtonClass(
            "primary",
            "sm",
            "mb-0.5 h-10 w-10 shrink-0 !px-0 sm:mb-0 sm:h-8 sm:w-8",
          )}
        >
          <LuArrowUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
        </button>
      </div>
      {showHelper ? (
        <p className="mt-1.5 hidden text-[11px] text-ink-subtle sm:block">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
