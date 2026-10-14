import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type { CountryCode };

import { getCountryName } from "./countries";

export type DialCodeOption = {
  /** ISO 3166-1 alpha-2 used by libphonenumber. */
  country: CountryCode;
  /** Calling code without + (e.g. "1", "91"). */
  dialCode: string;
  name: string;
  /** Select label: "India (+91)". */
  label: string;
};

let cachedDialCodes: DialCodeOption[] | null = null;

/** Countries with dial codes for phone / WhatsApp pickers. */
export function listDialCodeOptions(): DialCodeOption[] {
  if (cachedDialCodes) return cachedDialCodes;

  cachedDialCodes = getCountries()
    .map((country) => {
      const dialCode = getCountryCallingCode(country);
      const name = getCountryName(country) ?? country;
      return {
        country,
        dialCode,
        name,
        label: `${name} (+${dialCode})`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return cachedDialCodes;
}

export type PhoneParts = {
  country: CountryCode;
  /** National number digits (no country code). */
  national: string;
};

const DEFAULT_COUNTRY: CountryCode = "US";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Split a stored phone into country + national parts for the input UI. */
export function parsePhoneParts(
  value: string | null | undefined,
  fallbackCountry: CountryCode = DEFAULT_COUNTRY,
): PhoneParts {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { country: fallbackCountry, national: "" };
  }

  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed?.country) {
    return {
      country: parsed.country,
      national: parsed.nationalNumber,
    };
  }

  // Already looks international but metadata couldn't resolve country.
  if (trimmed.startsWith("+")) {
    const match = listDialCodeOptions().find((option) =>
      trimmed.startsWith(`+${option.dialCode}`),
    );
    if (match) {
      return {
        country: match.country,
        national: digitsOnly(trimmed.slice(1 + match.dialCode.length)),
      };
    }
  }

  return {
    country: fallbackCountry,
    national: digitsOnly(trimmed),
  };
}

/**
 * Build E.164 (+15551234567). Returns null when national is empty.
 * Uses libphonenumber when possible; otherwise +dial+digits.
 */
export function composeE164(
  country: CountryCode,
  national: string,
): string | null {
  const nationalDigits = digitsOnly(national);
  if (!nationalDigits) return null;

  const parsed = parsePhoneNumberFromString(nationalDigits, country);
  if (parsed) {
    return parsed.format("E.164");
  }

  const dial = getCountryCallingCode(country);
  return `+${dial}${nationalDigits}`;
}

/** Soft check for international storage shape (E.164 / possible number). */
export function isInternationalPhone(
  value: string | null | undefined,
): boolean {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed?.isPossible()) return true;
  return /^\+[1-9]\d{6,14}$/.test(trimmed);
}

/** Human-readable international phone for UI (falls back to raw). */
export function formatPhoneDisplay(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed) {
    return parsed.formatInternational();
  }
  return trimmed;
}

/** Digits-only href target for tel: / wa.me links. */
export function phoneDigitsForHref(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const parsed = parsePhoneNumberFromString(value.trim());
  if (parsed) return parsed.number.replace(/^\+/, "");
  const digits = digitsOnly(value);
  return digits || null;
}

/** Prefer nationality as dial default when it is a valid phone region. */
export function phoneCountryFromNationality(
  nationality: string | null | undefined,
): CountryCode | null {
  if (!nationality) return null;
  const code = nationality.trim().toUpperCase() as CountryCode;
  try {
    getCountryCallingCode(code);
    return code;
  } catch {
    return null;
  }
}
