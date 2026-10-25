import {
  findTripById,
  insertBookingAuditLogs,
  updateBooking as dbUpdateBooking,
  updateStayOption,
  type Booking,
} from "@pureluxe/db";
import {
  AppError,
  bookingMessages,
  type UpdateBookingInput,
} from "@pureluxe/shared";

import {
  syncClientPriceFromChoices,
  syncTripCommercials,
} from "@/lib/trip-builder/pricing/sync-trip-totals";

import { AUDIT_BOOKING_FIELDS } from "./booking-fields";
import {
  buildBookingDetail,
  type BookingDetail,
} from "./booking-detail";
import { nightsBetween } from "./booking-dates";
import { requireEditableBooking } from "./require-active-booking";
import {
  PRICING_LOCK_FIELDS,
  TRIP_BUILDER_OWNED_FIELDS,
  tripBuilderOwnsStay,
} from "./trip-builder-booking";

function toAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
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

  if (tripBuilderOwnsStay(existing)) {
    const blocked = TRIP_BUILDER_OWNED_FIELDS.some(
      (field) => field in resolvedPatch,
    );
    if (blocked) {
      throw new AppError({
        userMessage: bookingMessages.error.tripBuilderOwned,
        code: "bookings.trip_builder_owned",
        status: 409,
      });
    }
  }

  if (existing.trip_id) {
    const lockedPrice = PRICING_LOCK_FIELDS.some((field) => field in resolvedPatch);
    if (lockedPrice) {
      const trip = await findTripById(existing.trip_id);
      if (trip?.pricing_locked_at) {
        throw new AppError({
          userMessage: bookingMessages.error.pricingLocked,
          code: "bookings.pricing_locked",
          status: 409,
        });
      }
    }
  }

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

  if (nextStart && nextEnd) {
    const isHotel = existing.service_type === "hotel";
    const invalid = isHotel
      ? nextStart >= nextEnd
      : nextStart > nextEnd;
    if (invalid) {
      throw new AppError({
        userMessage: isHotel
          ? bookingMessages.error.dateRange
          : "End date must be on or after the start date.",
        code: "bookings.invalid_date_range",
        status: 400,
      });
    }
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

  // Keep the trip line item and trip totals in step with this stay's commercial figures.
  if (
    existing.trip_id &&
    existing.trip_line_item_id &&
    ("sell_amount" in writePatch || "cost_amount" in writePatch)
  ) {
    const linePatch: {
      sell_amount?: number | null;
      cost_internal?: number;
    } = {};
    if ("sell_amount" in writePatch) {
      linePatch.sell_amount =
        writePatch.sell_amount == null
          ? null
          : Number(writePatch.sell_amount);
    }
    if (
      "cost_amount" in writePatch &&
      writePatch.cost_amount != null &&
      Number.isFinite(Number(writePatch.cost_amount))
    ) {
      linePatch.cost_internal = Number(writePatch.cost_amount);
    }
    if (Object.keys(linePatch).length > 0) {
      await updateStayOption(existing.trip_line_item_id, linePatch);
    }
    if ("sell_amount" in writePatch) {
      await syncClientPriceFromChoices(existing.trip_id);
    }
    await syncTripCommercials(existing.trip_id);
  }

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
