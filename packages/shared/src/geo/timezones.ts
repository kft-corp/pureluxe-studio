export type TimezoneOption = {
  /** IANA timezone id (e.g. Asia/Kolkata). */
  id: string;
  label: string;
};

let cachedTimezones: TimezoneOption[] | null = null;

function timezoneLabel(id: string): string {
  return id.replace(/_/g, " ");
}

/** IANA time zones from the runtime (Node / modern browsers). */
export function listTimezoneOptions(): TimezoneOption[] {
  if (cachedTimezones) return cachedTimezones;

  const ids =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC"];

  cachedTimezones = ids
    .map((id) => ({ id, label: timezoneLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));

  return cachedTimezones;
}

export function isValidTimezone(id: string | null | undefined): boolean {
  if (!id?.trim()) return false;
  return listTimezoneOptions().some((option) => option.id === id.trim());
}

export function normalizeTimezone(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isValidTimezone(trimmed) ? trimmed : null;
}
