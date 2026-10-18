/** Default label when a trip has no client or place yet. */
export const NEW_TRIP_TITLE = "New trip";

export type TripTitleParts = {
  clientName?: string | null;
  city?: string | null;
  hotel?: string | null;
};

/**
 * Build an auto trip title.
 * Prefer Client · City, else Client · Hotel, else Client, else place, else "New trip".
 */
export function buildTripAutoTitle(parts: TripTitleParts): string {
  const client = parts.clientName?.trim() || null;
  const city = parts.city?.trim() || null;
  const hotel = parts.hotel?.trim() || null;
  const place = city || hotel;

  if (client && place) return `${client} · ${place}`;
  if (client) return client;
  if (place) return place;
  return NEW_TRIP_TITLE;
}

/** True when the stored title looks system-generated and may be upgraded. */
function shouldReplaceTripTitle(
  current: string | null | undefined,
  parts: TripTitleParts,
): boolean {
  const cur = current?.trim() || "";
  if (!cur) return true;
  if (cur === NEW_TRIP_TITLE || cur === "Untitled trip") return true;

  const client = parts.clientName?.trim() || null;
  if (client && (cur === client || cur.startsWith(`${client} · `))) {
    return true;
  }

  const place = parts.city?.trim() || parts.hotel?.trim() || null;
  if (place && cur === place) return true;

  return false;
}

/**
 * Next title to persist, or null if the current title should be left alone
 * (manual title, or already matches the auto form).
 */
export function nextTripTitle(
  current: string | null | undefined,
  parts: TripTitleParts,
): string | null {
  const next = buildTripAutoTitle(parts);
  if (!shouldReplaceTripTitle(current, parts)) return null;
  if ((current?.trim() || "") === next) return null;
  return next;
}

/** Primary label for history / switcher rows. */
export function displayTripTitle(trip: {
  title?: string | null;
  client_display_name?: string | null;
}): string {
  return (
    trip.title?.trim() ||
    trip.client_display_name?.trim() ||
    NEW_TRIP_TITLE
  );
}

/**
 * Secondary line for history rows — last message preview only.
 * Empty when there is no chat yet (no placeholder copy).
 */
export function displayTripSubtitle(trip: {
  last_studio_message_preview?: string | null;
}): string {
  return trip.last_studio_message_preview?.trim() || "";
}

/** One or two letters for the history avatar. */
export function tripTitleInitial(trip: {
  title?: string | null;
  client_display_name?: string | null;
}): string {
  const source =
    trip.client_display_name?.trim() ||
    displayTripTitle(trip).replace(/\s*·\s*/g, " ");
  const parts = source.split(/\s+/).filter((part) => part && part !== "·");
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? "T").toUpperCase();
}
