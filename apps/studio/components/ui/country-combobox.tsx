"use client";

import { useMemo } from "react";
import {
  getCountryName,
  isValidCountryCode,
  listCountryOptions,
} from "@pureluxe/shared";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "./searchable-combobox";

const COUNTRY_OPTIONS: SearchableComboboxOption[] = listCountryOptions().map(
  (option) => ({
    value: option.code,
    label: option.name,
    meta: option.code,
  }),
);

type CountryComboboxProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable ISO country picker — stores alpha-2 codes (US, IN, …).
 */
export function CountryCombobox({
  id,
  value,
  onChange,
  placeholder = "Search countries…",
  disabled,
  className,
}: Readonly<CountryComboboxProps>) {
  const options = useMemo(() => COUNTRY_OPTIONS, []);

  return (
    <SearchableCombobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      getLabel={(code) =>
        isValidCountryCode(code) ? (getCountryName(code) ?? code) : null
      }
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      clearLabel="Clear country"
      toggleLabel="Toggle country list"
      emptyLabel={(query) => `No countries match “${query.trim()}”`}
    />
  );
}
