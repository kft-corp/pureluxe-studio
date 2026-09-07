"use client";

import { useMemo } from "react";
import { isValidTimezone, listTimezoneOptions } from "@pureluxe/shared";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "./searchable-combobox";

const TIMEZONE_OPTIONS: SearchableComboboxOption[] = listTimezoneOptions().map(
  (option) => ({
    value: option.id,
    label: option.label,
  }),
);

type TimezoneComboboxProps = {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable IANA timezone picker — stores ids (Asia/Kolkata, …).
 */
export function TimezoneCombobox({
  id,
  value,
  onChange,
  placeholder = "Search timezones…",
  disabled,
  className,
}: Readonly<TimezoneComboboxProps>) {
  const options = useMemo(() => TIMEZONE_OPTIONS, []);

  return (
    <SearchableCombobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      getLabel={(idValue) =>
        isValidTimezone(idValue) ? idValue.replaceAll("_", " ") : null
      }
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      clearLabel="Clear timezone"
      toggleLabel="Toggle timezone list"
      emptyLabel={(query) => `No timezones match “${query.trim()}”`}
      maxResults={14}
    />
  );
}
