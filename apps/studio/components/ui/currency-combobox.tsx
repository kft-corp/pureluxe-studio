"use client";

import { useMemo } from "react";
import {
  getCurrencyName,
  isValidCurrencyCode,
  listCurrencyOptions,
} from "@pureluxe/shared";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "./searchable-combobox";

const CURRENCY_OPTIONS: SearchableComboboxOption[] = listCurrencyOptions().map(
  (option) => ({
    value: option.code,
    label: `${option.code} — ${option.name}`,
    meta: option.code,
  }),
);

type CurrencyComboboxProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable ISO currency picker — stores codes (USD, EUR, INR, …).
 */
export function CurrencyCombobox({
  id,
  value,
  onChange,
  placeholder = "Search currencies…",
  disabled,
  className,
}: Readonly<CurrencyComboboxProps>) {
  const options = useMemo(() => {
    const normalized = value.trim().toUpperCase();
    if (
      normalized &&
      !CURRENCY_OPTIONS.some((option) => option.value === normalized)
    ) {
      return [
        {
          value: normalized,
          label: normalized,
          meta: normalized,
        },
        ...CURRENCY_OPTIONS,
      ];
    }
    return CURRENCY_OPTIONS;
  }, [value]);

  return (
    <SearchableCombobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      getLabel={(code) => {
        if (!code.trim()) return null;
        if (isValidCurrencyCode(code)) {
          const name = getCurrencyName(code);
          return name ? `${code.toUpperCase()} — ${name}` : code.toUpperCase();
        }
        return code.toUpperCase();
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      clearLabel="Clear currency"
      toggleLabel="Toggle currency list"
      emptyLabel={(query) => `No currencies match “${query.trim()}”`}
      maxResults={16}
    />
  );
}
