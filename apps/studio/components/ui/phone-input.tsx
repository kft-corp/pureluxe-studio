"use client";

import { useEffect, useMemo, useState } from "react";
import {
  composeE164,
  listDialCodeOptions,
  parsePhoneParts,
  phoneCountryFromNationality,
  type CountryCode,
} from "@pureluxe/shared";

import { modalFieldClassName } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

const DIAL_OPTIONS = listDialCodeOptions();

type PhoneInputProps = {
  id?: string;
  value: string;
  onChange: (e164: string) => void;
  /** When set and phone is empty, prefer this region’s dial code. */
  defaultCountryHint?: string | null;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-required"?: boolean;
};

/**
 * Country dial code + national number → stores E.164 (e.g. +15551234567).
 * Uses container queries so dial + number stay fully visible in narrow fields.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  defaultCountryHint,
  placeholder = "555 0100",
  disabled,
  className,
  "aria-required": ariaRequired,
}: Readonly<PhoneInputProps>) {
  const hintCountry = phoneCountryFromNationality(defaultCountryHint);

  const initial = useMemo(
    () => parsePhoneParts(value, hintCountry ?? "US"),
    // Seed once on mount from the incoming value.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional seed
    [],
  );

  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const composed = composeE164(country, national) ?? "";
    if (value === composed) return;
    const next = parsePhoneParts(value, hintCountry ?? country);
    setCountry(next.country);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid loops on local edits
  }, [value]);

  useEffect(() => {
    if (!hintCountry) return;
    if (national.trim() || value.trim()) return;
    setCountry(hintCountry);
  }, [hintCountry, national, value]);

  function emit(nextCountry: CountryCode, nextNational: string) {
    onChange(composeE164(nextCountry, nextNational) ?? "");
  }

  const dialLabel =
    DIAL_OPTIONS.find((option) => option.country === country)?.dialCode ?? "";

  return (
    <div
      className={cn(
        "@container flex w-full min-w-0 flex-col gap-2",
        className,
      )}
    >
      <div className="flex w-full min-w-0 flex-col gap-2 @[18rem]:flex-row @[18rem]:items-stretch">
        <label className="sr-only" htmlFor={id ? `${id}-country` : undefined}>
          Country code
        </label>
        <select
          id={id ? `${id}-country` : undefined}
          value={country}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value as CountryCode;
            setCountry(next);
            emit(next, national);
          }}
          className={cn(
            modalFieldClassName,
            "mt-0 w-full shrink-0 @[18rem]:w-38",
          )}
          aria-label="Country calling code"
        >
          {DIAL_OPTIONS.map((option) => (
            <option key={option.country} value={option.country}>
              {option.country} +{option.dialCode}
            </option>
          ))}
        </select>
        <div className="relative w-full min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted tabular-nums">
            +{dialLabel}
          </span>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            disabled={disabled}
            value={national}
            placeholder={placeholder}
            aria-required={ariaRequired}
            onChange={(event) => {
              const next = event.target.value.replace(/[^\d\s()-]/g, "");
              setNational(next);
              emit(country, next);
            }}
            className={cn(modalFieldClassName, "mt-0 w-full min-w-0 pl-12")}
          />
        </div>
      </div>
    </div>
  );
}
