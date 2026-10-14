import { ApiRequestError } from "@/lib/api/client";
import { getBooking, updateBooking } from "@/lib/api/bookings";
import type { BookingDetail } from "@/lib/bookings";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

/** Next calendar day (UTC date string) — keeps end > start in date pickers. */
export function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function textFromUnknown(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

/** `datetime-local` value from an ISO timestamp (browser local wall clock). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ISO string from a `datetime-local` value, or null when empty. */
export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sameFieldValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a ?? "") === String(b ?? "");
}

/** Only include keys whose values differ from the current booking. */
export function dirtyPatch<T extends Record<string, unknown>>(
  next: T,
  previous: Record<string, unknown>,
): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (!sameFieldValue(next[key], previous[key as string])) {
      patch[key] = next[key];
    }
  }
  return patch;
}

/** PATCH booking; close on success / empty patch; reload on 409 conflict. */
export async function saveBookingPatch(input: {
  bookingId: string;
  updatedAt: string;
  patch: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (detail: BookingDetail) => void;
}): Promise<void> {
  if (Object.keys(input.patch).length === 0) {
    input.onClose();
    return;
  }

  try {
    const response = await updateBooking(input.bookingId, input.patch, {
      ifUnmodifiedSince: input.updatedAt,
    });
    input.onClose();
    input.onSuccess(response.data);
    showOptionalSuccessToast(response.message);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 409 || error.code === "CONFLICT")
    ) {
      showApiError(error);
      try {
        const fresh = await getBooking(input.bookingId);
        input.onSuccess(fresh.data);
        input.onClose();
      } catch {
        // Keep dialog open if reload fails.
      }
      return;
    }
    throw error;
  }
}
