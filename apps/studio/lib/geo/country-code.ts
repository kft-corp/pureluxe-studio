import { isValidCountryCode, listCountryOptions } from "@pureluxe/shared";

/**
 * Normalize stored nationality / country text to an ISO alpha-2 code for
 * CountryCombobox. Accepts codes ("IN") or common English names ("India").
 */
export function resolveCountryCode(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  if (isValidCountryCode(value)) return value.toUpperCase();
  const byName = listCountryOptions().find(
    (option) => option.name.toLowerCase() === value.toLowerCase(),
  );
  return byName?.code ?? "";
}
