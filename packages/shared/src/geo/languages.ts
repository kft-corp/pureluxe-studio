import ISO6391 from "iso-639-1";

export type LanguageOption = {
  /** ISO 639-1 code (e.g. en, hi, fr). */
  code: string;
  name: string;
};

let cachedLanguages: LanguageOption[] | null = null;

/** All ISO 639-1 languages for preferred-language pickers (A–Z by name). */
export function listLanguageOptions(): LanguageOption[] {
  if (cachedLanguages) return cachedLanguages;

  cachedLanguages = ISO6391.getAllCodes()
    .map((code) => ({
      code,
      name: ISO6391.getName(code) || code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return cachedLanguages;
}

export function isValidLanguageCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return false;
  return ISO6391.validate(code.trim().toLowerCase());
}

export function getLanguageName(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  const normalized = code.trim().toLowerCase();
  if (!ISO6391.validate(normalized)) return null;
  return ISO6391.getName(normalized) || null;
}

export function normalizeLanguageCode(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return ISO6391.validate(trimmed) ? trimmed : null;
}
