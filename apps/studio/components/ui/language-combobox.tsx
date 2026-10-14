"use client";

import { useMemo } from "react";
import {
  getLanguageName,
  isValidLanguageCode,
  listLanguageOptions,
} from "@pureluxe/shared";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "./searchable-combobox";

const LANGUAGE_OPTIONS: SearchableComboboxOption[] = listLanguageOptions().map(
  (option) => ({
    value: option.code,
    label: option.name,
    meta: option.code.toUpperCase(),
  }),
);

type LanguageComboboxProps = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Searchable ISO 639-1 language picker — stores codes (en, hi, fr, …).
 */
export function LanguageCombobox({
  id,
  value,
  onChange,
  placeholder = "Search languages…",
  disabled,
  className,
}: Readonly<LanguageComboboxProps>) {
  const options = useMemo(() => LANGUAGE_OPTIONS, []);

  return (
    <SearchableCombobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      getLabel={(code) =>
        isValidLanguageCode(code) ? (getLanguageName(code) ?? code) : null
      }
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      clearLabel="Clear language"
      toggleLabel="Toggle language list"
      emptyLabel={(query) => `No languages match “${query.trim()}”`}
    />
  );
}
