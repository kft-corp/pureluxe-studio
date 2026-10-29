import type { ChatMessage } from "@/lib/trip-builder";

const STORAGE_KEY = "pureluxe.trip-builder.soft-handoff";
/** Drop stashed threads that never got claimed (tab left mid-handoff). */
const MAX_AGE_MS = 30_000;

type SoftHandoffPayload = {
  tripId: string;
  messages: ChatMessage[];
  savedAt: number;
};

function readPayload(): SoftHandoffPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SoftHandoffPayload;
    if (!parsed?.tripId || !Array.isArray(parsed.messages)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** Keep the live home thread across a create → `?trip=` navigation remount. */
export function stashSoftTripHandoff(tripId: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined" || messages.length === 0) return;
  try {
    const payload: SoftHandoffPayload = {
      tripId,
      messages,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota — soft handoff still works without remount.
  }
}

export function clearSoftTripHandoff(tripId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!tripId) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const parsed = readPayload();
    if (!parsed || parsed.tripId === tripId) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

/** Read a stashed thread for this trip without consuming it (Strict Mode safe). */
export function peekSoftTripHandoff(tripId: string): ChatMessage[] | null {
  const parsed = readPayload();
  if (!parsed || parsed.tripId !== tripId || parsed.messages.length === 0) return null;
  return parsed.messages;
}
