"use client";

import { modalFieldClassName } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

/** Normalize free text / HH:mm:ss → `HH:mm` for `<input type="time">`. */
export function normalizeTimeOfDay(raw: string | null | undefined): string {
  if (raw == null) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(trimmed);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

type TimeOfDayInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Step in seconds. Default 900 = 15-minute hotel-friendly slots. */
  stepSeconds?: number;
  "aria-label"?: string;
};

/**
 * Local time-of-day picker — browser clock UI, constrained to valid HH:mm.
 * No third-party package: native `type="time"` is the efficient, accessible choice
 * for hotel check-in / check-out and matches our stored `HH:mm` shape.
 */
export function TimeOfDayInput({
  id,
  value,
  onChange,
  disabled,
  className,
  stepSeconds = 900,
  "aria-label": ariaLabel,
}: Readonly<TimeOfDayInputProps>) {
  const normalized = normalizeTimeOfDay(value);

  return (
    <input
      id={id}
      type="time"
      step={stepSeconds}
      value={normalized}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => {
        onChange(normalizeTimeOfDay(event.target.value));
      }}
      className={cn(modalFieldClassName, className)}
    />
  );
}
