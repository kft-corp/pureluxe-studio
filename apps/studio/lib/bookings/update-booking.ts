import {
  insertBookingAuditLogs,
  updateBooking as dbUpdateBooking,
  type Booking,
} from "@pureluxe/db";
import {
  AppError,
  bookingMessages,
  type UpdateBookingInput,
} from "@pureluxe/shared";

import { AUDIT_BOOKING_FIELDS } from "./booking-fields";
import {
  buildBookingDetail,
  type BookingDetail,
} from "./booking-detail";
import { requireEditableBooking } from "./require-active-booking";

function toAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function nightsBetween(
  startDate: string | null,
  endDate: string | null,
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return nights >= 0 ? nights : null;
}

function mergeServiceDetails(
  existing: Record<string, unknown>,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (patch === undefined) return undefined;

  const next: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === "" || value === undefined || value === null) {
      delete next[key];
      continue;
    }
    next[key] = value;
  }
  return next;
}

/** Patch whitelisted booking fields; write only changed columns; return detail. */
export async function updateBooking(
  bookingId: string,
  patch: UpdateBookingInput,
  actor: { memberId: string },
  options?: { ifUnmodifiedSince?: string | null },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  if (options?.ifUnmodifiedSince) {
    const expected = new Date(options.ifUnmodifiedSince).getTime();
    const actual = new Date(existing.updated_at).getTime();
    if (
      Number.isFinite(expected) &&
      Number.isFinite(actual) &&
      actual > expected
    ) {
      throw new AppError({
        userMessage: bookingMessages.error.conflict,
        code: "CONFLICT",
        status: 409,
      });
    }
  }

const { service_details: serviceDetailsPatch, ...restPatch } = patch;
  const resolvedPatch: UpdateBookingInput = { ...restPatch };

  const mergedServiceDetails = mergeServiceDetails(
    existing.service_details ?? {},
    serviceDetailsPatch,
  );
  if (mergedServiceDetails !== undefined) {
    resolvedPatch.service_details = mergedServiceDetails;
  }

  const nextStart =
    resolvedPatch.start_date !== undefined
      ? resolvedPatch.start_date
      : existing.start_date;
  const nextEnd =
    resolvedPatch.end_date !== undefined
      ? resolvedPatch.end_date
      : existing.end_date;

  if (nextStart && nextEnd && nextStart >= nextEnd) {
    throw new AppError({
      userMessage: bookingMessages.error.dateRange,
      code: "bookings.invalid_date_range",
      status: 400,
    });
  }

  if (
    resolvedPatch.nights === undefined &&
    (resolvedPatch.start_date !== undefined ||
      resolvedPatch.end_date !== undefined)
  ) {
    const computed = nightsBetween(nextStart, nextEnd);
    if (computed !== null) {
      resolvedPatch.nights = computed;
    }
  }

  const fieldChanges: Record<
    string,
    { old_value: string | null; new_value: string | null }
  > = {};
  const writePatch: Record<string, unknown> = {};

  for (const field of AUDIT_BOOKING_FIELDS) {
    if (!(field in resolvedPatch)) continue;
    const nextValue = resolvedPatch[field as keyof typeof resolvedPatch];
    const previousValue = existing[field as keyof Booking];
    const oldValue = toAuditValue(previousValue);
    const newValue = toAuditValue(nextValue);
    if (oldValue === newValue) continue;
    fieldChanges[field] = { old_value: oldValue, new_value: newValue };
    writePatch[field] = nextValue;
  }

  if (Object.keys(writePatch).length === 0) {
    return buildBookingDetail(existing);
  }

  const updated = await dbUpdateBooking({
    id: bookingId,
    ...writePatch,
  });

  const changedFields = Object.keys(fieldChanges);

  // Audit write and detail assembly are independent — run together.
  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: existing.id,
        action: "updated",
        field_name:
          changedFields.length === 1 ? changedFields[0]! : "booking",
        old_value:
          changedFields.length === 1
            ? (fieldChanges[changedFields[0]!]?.old_value ?? null)
            : null,
        new_value:
          changedFields.length === 1
            ? (fieldChanges[changedFields[0]!]?.new_value ?? null)
            : null,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          fields: fieldChanges,
        },
      },
    ]),
    buildBookingDetail(updated),
  ]);

  return detail;
}
