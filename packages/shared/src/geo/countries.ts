import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

export type CountryOption = {
  /** ISO 3166-1 alpha-2 (e.g. US, IN). */
  code: string;
  /** English official name. */
  name: string;
};

let cachedOptions: CountryOption[] | null = null;

/** All countries for nationality pickers (English names, A–Z). */
export function listCountryOptions(): CountryOption[] {
  if (cachedOptions) return cachedOptions;

  const names = countries.getNames("en", { select: "official" });
  cachedOptions = Object.entries(names)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return cachedOptions;
}

/** True when value is a valid ISO 3166-1 alpha-2 code. */
export function isValidCountryCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return countries.isValid(code.trim().toUpperCase());
}

/** English name for an alpha-2 code, or null if unknown. */
export function getCountryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!countries.isValid(normalized)) return null;
  return countries.getName(normalized, "en", { select: "official" }) ?? null;
}

/** Normalize to alpha-2 or null. */
export function normalizeCountryCode(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  return countries.isValid(upper) ? upper : null;
}
