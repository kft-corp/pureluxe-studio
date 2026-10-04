"use client";

import { useState } from "react";
import { LuArrowUp } from "react-icons/lu";

import { studioButtonClass, studioChipClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type TripBuilderComposerProps = {
  placeholder: string;
  helperText?: string;
  chips?: Array<{ id: string; label: string; onClick: () => void }>;
  disabled?: boolean;
  onSend: (text: string) => void;
};

/** Always-open notes box — chips are shortcuts for the current step only. */
export function TripBuilderComposer({
  placeholder,
  helperText = "Notes for this trip — the agent lands next.",
  chips = [],
  disabled,
  onSend,
}: TripBuilderComposerProps) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface-raised px-3 py-2 sm:px-4">
      {chips.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {chips.slice(0, 2).map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={chip.onClick}
              className={studioChipClass(false)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 focus-within:border-brand-dark/30 focus-within:ring-1 focus-within:ring-brand-dark/10">
        <textarea
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className={cn(
            "max-h-20 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] leading-5 text-ink outline-none",
            "placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send"
          className={studioButtonClass("primary", "sm", "h-7 w-7 shrink-0 !px-0")}
        >
          <LuArrowUp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-subtle">{helperText}</p>
    </div>
  );
}
