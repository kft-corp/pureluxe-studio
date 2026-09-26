"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  BOOKING_EDITABLE_STATUSES,
  bookingMessages,
  parseBookingServiceDetails,
} from "@pureluxe/shared";

import {
  CurrencyCombobox,
  TimeOfDayInput,
  normalizeTimeOfDay,
} from "@/components/ui";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import type { BookingDetail } from "@/lib/bookings";
import {
  BOARD_BASIS_PRESETS,
  BOOKING_CHANNEL_PRESETS,
  boardBasisFormStateFromDetails,
  formatBookingStatus,
  resolveBoardBasisFields,
} from "@/lib/bookings";
import {
  dayAfter,
  dirtyPatch,
  emptyToNull,
  fromDatetimeLocalValue,
  numberOrNull,
  saveBookingPatch,
  textFromUnknown,
  toDatetimeLocalValue,
} from "@/lib/bookings/booking-edit-helpers";
import {
  showApiError,
  showWarningToast,
} from "@/lib/feedback/toast";
import { cn } from "@/lib/utils/cn";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>
      ) : null}
      {children}
    </label>
  );
}

type SectionFormProps = {
  detail: BookingDetail;
  onClose: () => void;
  onSuccess: (detail: BookingDetail) => void;
};

function SectionFormShell({
  title,
  description,
  loading,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <ModalButton
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="booking-section-form"
            variant="primary"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Saving…" : "Save"}
          </ModalButton>
        </>
      }
    >
      <form
        id="booking-section-form"
        onSubmit={onSubmit}
        className="min-w-0 space-y-4 overflow-x-hidden px-5 py-5"
      >
        {children}
      </form>
    </Modal>
  );
}

export function ReservationForm({
  detail,
  onClose,
  onSuccess,
}: SectionFormProps) {
  const booking = detail.booking;
  const [title, setTitle] = useState(booking.title);
  const [hotelName, setHotelName] = useState(booking.hotel_name ?? "");
  const [city, setCity] = useState(booking.city ?? "");
  const [country, setCountry] = useState(booking.country ?? "");
  const [chain, setChain] = useState(booking.chain ?? "");
  const [startDate, setStartDate] = useState(booking.start_date ?? "");
  const [endDate, setEndDate] = useState(booking.end_date ?? "");
  const [numRooms, setNumRooms] = useState(
    booking.num_rooms == null ? "" : String(booking.num_rooms),
  );
  const [numAdults, setNumAdults] = useState(
    booking.num_adults == null ? "" : String(booking.num_adults),
  );
  const [numChildren, setNumChildren] = useState(
    booking.num_children == null ? "" : String(booking.num_children),
  );
  const [vipFlag, setVipFlag] = useState(booking.vip_flag);
  const [loading, setLoading] = useState(false);

  const isHotel = booking.service_type === "hotel";
  const isFlight = booking.service_type === "flight";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (!title.trim()) {
        showWarningToast("Enter a booking title.");
        setLoading(false);
        return;
      }

      const nextStart = emptyToNull(startDate);
      const nextEnd = emptyToNull(endDate);
      if (nextStart && nextEnd) {
        const invalid = isHotel
          ? nextStart >= nextEnd
          : nextStart > nextEnd;
        if (invalid) {
          showWarningToast(
            isHotel
              ? bookingMessages.error.dateRange
              : "End date must be on or after the start date.",
          );
          setLoading(false);
          return;
        }
      }

      const rooms = numberOrNull(numRooms);
      const adults = numberOrNull(numAdults);
      const children = numberOrNull(numChildren);
      if ([rooms, adults, children].some((value) => Number.isNaN(value))) {
        showWarningToast("Use whole numbers for rooms and party size.");
        setLoading(false);
        return;
      }

      const next = {
        title: title.trim(),
        hotel_name: emptyToNull(hotelName),
        city: isFlight ? null : emptyToNull(city),
        country: isFlight ? null : emptyToNull(country),
        chain: emptyToNull(chain),
        start_date: nextStart,
        end_date: nextEnd,
        num_rooms: rooms,
        num_adults: adults,
        num_children: children,
        vip_flag: vipFlag,
      };
      const patch = dirtyPatch(next, {
        title: booking.title,
        hotel_name: booking.hotel_name,
        city: booking.city,
        country: booking.country,
        chain: booking.chain,
        start_date: booking.start_date,
        end_date: booking.end_date,
        num_rooms: booking.num_rooms,
        num_adults: booking.num_adults,
        num_children: booking.num_children,
        vip_flag: booking.vip_flag,
      });

      await saveBookingPatch({
        bookingId: booking.id,
        updatedAt: booking.updated_at,
        patch,
        onClose,
        onSuccess,
      });
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit reservation"
      description="Core stay or service details advisors need on the ledger."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Title" htmlFor="edit-booking-title">
        <input
          id="edit-booking-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={cn(modalFieldClassName)}
          required
        />
      </Field>
      {isHotel ? (
        <>
          <Field label="Property" htmlFor="edit-hotel-name">
            <input
              id="edit-hotel-name"
              value={hotelName}
              onChange={(event) => setHotelName(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="edit-city">
              <input
                id="edit-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Country" htmlFor="edit-country">
              <input
                id="edit-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
          <Field label="Chain" htmlFor="edit-chain">
            <input
              id="edit-chain"
              value={chain}
              onChange={(event) => setChain(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </>
      ) : !isFlight ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" htmlFor="edit-city">
            <input
              id="edit-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <Field label="Country" htmlFor="edit-country">
            <input
              id="edit-country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={isFlight ? "Departure date" : "Start date"}
          htmlFor="edit-start-date"
        >
          <input
            id="edit-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              const next = event.target.value;
              setStartDate(next);
              if (!next || !endDate) return;
              if (isHotel && next >= endDate) {
                setEndDate(dayAfter(next));
                return;
              }
              if (!isHotel && next > endDate) {
                setEndDate(next);
              }
            }}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field
          label={isFlight ? "Arrival date" : "End date"}
          htmlFor="edit-end-date"
          hint={
            isFlight && startDate && endDate && startDate === endDate
              ? "Same-day arrival"
              : undefined
          }
        >
          <input
            id="edit-end-date"
            type="date"
            value={endDate}
            min={
              startDate
                ? isHotel
                  ? dayAfter(startDate)
                  : startDate
                : undefined
            }
            onChange={(event) => setEndDate(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
      </div>
      {isHotel ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Rooms" htmlFor="edit-rooms">
            <input
              id="edit-rooms"
              inputMode="numeric"
              value={numRooms}
              onChange={(event) => setNumRooms(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <Field label="Adults" htmlFor="edit-adults">
            <input
              id="edit-adults"
              inputMode="numeric"
              value={numAdults}
              onChange={(event) => setNumAdults(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <Field label="Children" htmlFor="edit-children">
            <input
              id="edit-children"
              inputMode="numeric"
              value={numChildren}
              onChange={(event) => setNumChildren(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adults" htmlFor="edit-adults">
            <input
              id="edit-adults"
              inputMode="numeric"
              value={numAdults}
              onChange={(event) => setNumAdults(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <Field label="Children" htmlFor="edit-children">
            <input
              id="edit-children"
              inputMode="numeric"
              value={numChildren}
              onChange={(event) => setNumChildren(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={vipFlag}
          onChange={(event) => setVipFlag(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        Mark as VIP booking
      </label>
    </SectionFormShell>
  );
}

export function CommercialForm({
  detail,
  onClose,
  onSuccess,
}: SectionFormProps) {
  const booking = detail.booking;
  const [supplierName, setSupplierName] = useState(booking.supplier_name ?? "");
  const [supplierRef, setSupplierRef] = useState(booking.supplier_ref ?? "");
  const [bookingChannel, setBookingChannel] = useState(
    booking.booking_channel ?? "",
  );
  const [currency, setCurrency] = useState(
    () => booking.currency?.trim().toUpperCase() ?? "",
  );
  const [sellAmount, setSellAmount] = useState(
    booking.sell_amount == null ? "" : String(booking.sell_amount),
  );
  const [costAmount, setCostAmount] = useState(
    booking.cost_amount == null ? "" : String(booking.cost_amount),
  );
  const [commission, setCommission] = useState(
    booking.commission_expected == null
      ? ""
      : String(booking.commission_expected),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const sell = numberOrNull(sellAmount);
      const cost = numberOrNull(costAmount);
      const expected = numberOrNull(commission);
      if ([sell, cost, expected].some((value) => Number.isNaN(value))) {
        showWarningToast("Use valid numbers for commercial amounts.");
        setLoading(false);
        return;
      }

      const next = {
        supplier_name: emptyToNull(supplierName),
        supplier_ref: emptyToNull(supplierRef),
        booking_channel: emptyToNull(bookingChannel),
        currency: emptyToNull(currency),
        sell_amount: sell,
        cost_amount: cost,
        commission_expected: expected,
      };
      const patch = dirtyPatch(next, {
        supplier_name: booking.supplier_name,
        supplier_ref: booking.supplier_ref,
        booking_channel: booking.booking_channel,
        currency: booking.currency?.trim().toUpperCase() ?? null,
        sell_amount: booking.sell_amount,
        cost_amount: booking.cost_amount,
        commission_expected: booking.commission_expected,
      });

      await saveBookingPatch({
        bookingId: booking.id,
        updatedAt: booking.updated_at,
        patch,
        onClose,
        onSuccess,
      });
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit commercial"
      description="Supplier refs and pricing snapshot — team only."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Supplier" htmlFor="edit-supplier-name">
        <input
          id="edit-supplier-name"
          value={supplierName}
          onChange={(event) => setSupplierName(event.target.value)}
          className={cn(modalFieldClassName)}
        />
      </Field>
      <Field
        label="Confirmation / PNR"
        htmlFor="edit-supplier-ref"
        hint="Add this when the supplier confirms."
      >
        <input
          id="edit-supplier-ref"
          value={supplierRef}
          onChange={(event) => setSupplierRef(event.target.value)}
          className={cn(modalFieldClassName, "font-mono")}
        />
      </Field>
      <Field
        label="Booking channel"
        htmlFor="edit-booking-channel"
        hint="How it was booked with the supplier."
      >
        <select
          id="edit-booking-channel"
          value={bookingChannel}
          onChange={(event) => setBookingChannel(event.target.value)}
          className={cn(modalFieldClassName)}
        >
          <option value="">Select channel…</option>
          {BOOKING_CHANNEL_PRESETS.map((option) => (
            <option key={option} value={option}>
              {option === "GDS"
                ? "GDS"
                : option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
          {bookingChannel &&
          !BOOKING_CHANNEL_PRESETS.includes(
            bookingChannel as (typeof BOOKING_CHANNEL_PRESETS)[number],
          ) ? (
            <option value={bookingChannel}>{bookingChannel}</option>
          ) : null}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" htmlFor="edit-currency">
          <CurrencyCombobox
            id="edit-currency"
            value={currency}
            onChange={setCurrency}
            placeholder="Search currencies…"
          />
        </Field>
        <Field
          label="Sell price"
          htmlFor="edit-sell"
          hint={currency ? `Amount in ${currency}` : "Pick a currency first"}
        >
          <input
            id="edit-sell"
            inputMode="decimal"
            value={sellAmount}
            onChange={(event) => setSellAmount(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field
          label="Supplier cost"
          htmlFor="edit-cost"
          hint={currency ? `Amount in ${currency}` : undefined}
        >
          <input
            id="edit-cost"
            inputMode="decimal"
            value={costAmount}
            onChange={(event) => setCostAmount(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        <Field
          label="Expected commission"
          htmlFor="edit-commission"
          hint={currency ? `Amount in ${currency}` : undefined}
        >
          <input
            id="edit-commission"
            inputMode="decimal"
            value={commission}
            onChange={(event) => setCommission(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
      </div>
    </SectionFormShell>
  );
}

export function PolicyForm({ detail, onClose, onSuccess }: SectionFormProps) {
  const booking = detail.booking;
  const statusChoices = BOOKING_EDITABLE_STATUSES.includes(
    booking.status as (typeof BOOKING_EDITABLE_STATUSES)[number],
  )
    ? [...BOOKING_EDITABLE_STATUSES]
    : [booking.status, ...BOOKING_EDITABLE_STATUSES];

  const [status, setStatus] = useState(booking.status);
  const [cancellationDeadline, setCancellationDeadline] = useState(
    booking.cancellation_deadline ?? "",
  );
  const [ticketTimeLimit, setTicketTimeLimit] = useState(() =>
    toDatetimeLocalValue(booking.ticket_time_limit),
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(
    booking.cancellation_policy ?? "",
  );
  const [cancellationReason, setCancellationReason] = useState(
    booking.cancellation_reason ?? "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const nextTicket = fromDatetimeLocalValue(ticketTimeLimit);
      const next: Record<string, unknown> = {
        cancellation_deadline: emptyToNull(cancellationDeadline),
        cancellation_policy: emptyToNull(cancellationPolicy),
        cancellation_reason: emptyToNull(cancellationReason),
      };
      if (booking.service_type === "flight") {
        next.ticket_time_limit = nextTicket;
      }

      // Confirm / cancel stay on toolbar actions — Policy only patches hold/complete.
      if (
        BOOKING_EDITABLE_STATUSES.includes(
          status as (typeof BOOKING_EDITABLE_STATUSES)[number],
        )
      ) {
        next.status = status;
      }

      const previous: Record<string, unknown> = {
        status: booking.status,
        cancellation_deadline: booking.cancellation_deadline,
        cancellation_policy: booking.cancellation_policy,
        cancellation_reason: booking.cancellation_reason,
      };
      if (booking.service_type === "flight") {
        previous.ticket_time_limit = booking.ticket_time_limit
          ? new Date(booking.ticket_time_limit).toISOString()
          : null;
      }

      const patch = dirtyPatch(next, previous);

      await saveBookingPatch({
        bookingId: booking.id,
        updatedAt: booking.updated_at,
        patch,
        onClose,
        onSuccess,
      });
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit policy & status"
      description="Deadlines and hold/complete status. Use Confirm or Cancel in the toolbar for those actions."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Status" htmlFor="edit-status">
        <select
          id="edit-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className={cn(modalFieldClassName)}
        >
          {statusChoices.map((value) => (
            <option key={value} value={value}>
              {formatBookingStatus(value)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cancellation deadline" htmlFor="edit-cancel-deadline">
          <input
            id="edit-cancel-deadline"
            type="date"
            value={cancellationDeadline}
            onChange={(event) => setCancellationDeadline(event.target.value)}
            className={cn(modalFieldClassName)}
          />
        </Field>
        {booking.service_type === "flight" ? (
          <Field label="Ticket time limit" htmlFor="edit-ticket-limit">
            <input
              id="edit-ticket-limit"
              type="datetime-local"
              value={ticketTimeLimit}
              onChange={(event) => setTicketTimeLimit(event.target.value)}
              className={cn(modalFieldClassName)}
            />
            <span className="mt-1 block text-xs text-ink-muted">
              Local date and time at ticketing.
            </span>
          </Field>
        ) : (
          <div className="hidden sm:block" aria-hidden />
        )}
      </div>
      <Field label="Cancellation policy" htmlFor="edit-cancel-policy">
        <textarea
          id="edit-cancel-policy"
          value={cancellationPolicy}
          onChange={(event) => setCancellationPolicy(event.target.value)}
          rows={3}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
      {booking.status === "cancelled" ? (
        <Field label="Cancellation reason" htmlFor="edit-cancel-reason">
          <textarea
            id="edit-cancel-reason"
            value={cancellationReason}
            onChange={(event) => setCancellationReason(event.target.value)}
            rows={2}
            className={cn(modalFieldClassName, "resize-y")}
          />
        </Field>
      ) : null}
    </SectionFormShell>
  );
}

export function NotesForm({ detail, onClose, onSuccess }: SectionFormProps) {
  const booking = detail.booking;
  const [internalNotes, setInternalNotes] = useState(
    booking.internal_notes ?? "",
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const next = { internal_notes: emptyToNull(internalNotes) };
      const patch = dirtyPatch(next, {
        internal_notes: booking.internal_notes,
      });

      await saveBookingPatch({
        bookingId: booking.id,
        updatedAt: booking.updated_at,
        patch,
        onClose,
        onSuccess,
      });
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit internal notes"
      description="Studio-only context for advisors and operations."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Internal notes" htmlFor="edit-internal-notes">
        <textarea
          id="edit-internal-notes"
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          rows={6}
          className={cn(modalFieldClassName, "resize-y")}
        />
      </Field>
    </SectionFormShell>
  );
}

export function ServiceDetailsForm({
  detail,
  onClose,
  onSuccess,
}: SectionFormProps) {
  const booking = detail.booking;
  const parsed = parseBookingServiceDetails(
    booking.service_type,
    booking.service_details,
  );
  const details = parsed.details as Record<string, unknown>;

  const [checkInTime, setCheckInTime] = useState(() =>
    normalizeTimeOfDay(textFromUnknown(details.check_in_time)),
  );
  const [checkOutTime, setCheckOutTime] = useState(() =>
    normalizeTimeOfDay(textFromUnknown(details.check_out_time)),
  );
  const [roomType, setRoomType] = useState(textFromUnknown(details.room_type));
  const initialBoard = boardBasisFormStateFromDetails({
    board_basis: details.board_basis,
    board_basis_label: details.board_basis_label,
  });
  const [boardCode, setBoardCode] = useState(initialBoard.code);
  const [boardCustomLabel, setBoardCustomLabel] = useState(
    initialBoard.customLabel,
  );
  const [ratePlan, setRatePlan] = useState(textFromUnknown(details.rate_plan));
  const [specialRequests, setSpecialRequests] = useState(
    textFromUnknown(details.special_requests),
  );
  const [ticketNumber, setTicketNumber] = useState(
    textFromUnknown(details.ticket_number),
  );
  const [bookingClass, setBookingClass] = useState(
    textFromUnknown(details.booking_class),
  );
  const existingSegments = Array.isArray(details.segments)
    ? (details.segments as Array<Record<string, unknown>>)
    : [];
  const firstSegment = existingSegments[0] ?? {};
  const [flightFrom, setFlightFrom] = useState(
    textFromUnknown(firstSegment.from).toUpperCase(),
  );
  const [flightTo, setFlightTo] = useState(
    textFromUnknown(firstSegment.to).toUpperCase(),
  );
  const [departTime, setDepartTime] = useState(() =>
    normalizeTimeOfDay(textFromUnknown(firstSegment.depart_at)),
  );
  const [arriveTime, setArriveTime] = useState(() =>
    normalizeTimeOfDay(textFromUnknown(firstSegment.arrive_at)),
  );
  const [airline, setAirline] = useState(
    textFromUnknown(firstSegment.airline),
  );
  const [flightNumber, setFlightNumber] = useState(
    textFromUnknown(firstSegment.flight_number).toUpperCase(),
  );
  const [cabin, setCabin] = useState(
    textFromUnknown(firstSegment.cabin) ||
      textFromUnknown(details.booking_class),
  );
  const [pickupAt, setPickupAt] = useState(textFromUnknown(details.pickup_at));
  const [dropoffAt, setDropoffAt] = useState(
    textFromUnknown(details.dropoff_at),
  );
  const [pickupLocation, setPickupLocation] = useState(
    textFromUnknown(details.pickup_location),
  );
  const [dropoffLocation, setDropoffLocation] = useState(
    textFromUnknown(details.dropoff_location),
  );
  const [meetingPoint, setMeetingPoint] = useState(
    textFromUnknown(details.meeting_point),
  );
  const [vehicleType, setVehicleType] = useState(
    textFromUnknown(details.vehicle_type),
  );
  const [driverName, setDriverName] = useState(
    textFromUnknown(details.driver_name),
  );
  const [driverPhone, setDriverPhone] = useState(
    textFromUnknown(details.driver_phone),
  );
  const [startAt, setStartAt] = useState(textFromUnknown(details.start_at));
  const [endAt, setEndAt] = useState(textFromUnknown(details.end_at));
  const [providerName, setProviderName] = useState(
    textFromUnknown(details.provider_name),
  );
  const [voucherRef, setVoucherRef] = useState(
    textFromUnknown(details.voucher_ref),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    details.duration_minutes == null ? "" : String(details.duration_minutes),
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      let nextDetails: Record<string, unknown> = {};

      if (booking.service_type === "hotel") {
        const board = resolveBoardBasisFields({
          code: boardCode,
          customLabel: boardCustomLabel,
        });
        nextDetails = {
          check_in_time: emptyToNull(normalizeTimeOfDay(checkInTime)),
          check_out_time: emptyToNull(normalizeTimeOfDay(checkOutTime)),
          room_type: emptyToNull(roomType),
          board_basis: board.board_basis,
          board_basis_label: board.board_basis_label,
          rate_plan: emptyToNull(ratePlan),
          special_requests: emptyToNull(specialRequests),
        };
      } else if (booking.service_type === "flight") {
        const depart = normalizeTimeOfDay(departTime);
        const arrive = normalizeTimeOfDay(arriveTime);
        const nextSegment: Record<string, string> = {};
        const from = flightFrom.trim().toUpperCase();
        const to = flightTo.trim().toUpperCase();
        if (from) nextSegment.from = from;
        if (to) nextSegment.to = to;
        if (depart) nextSegment.depart_at = depart;
        if (arrive) nextSegment.arrive_at = arrive;
        if (airline.trim()) nextSegment.airline = airline.trim();
        if (flightNumber.trim()) {
          nextSegment.flight_number = flightNumber.trim().toUpperCase();
        }
        if (cabin.trim()) nextSegment.cabin = cabin.trim();
        const preserved = existingSegments.slice(1);
        nextDetails = {
          ticket_number: emptyToNull(ticketNumber),
          booking_class: emptyToNull(cabin || bookingClass),
          segments:
            Object.keys(nextSegment).length > 0 || preserved.length > 0
              ? [nextSegment, ...preserved]
              : [],
        };
      } else if (booking.service_type === "transfer") {
        nextDetails = {
          pickup_at: emptyToNull(pickupAt),
          dropoff_at: emptyToNull(dropoffAt),
          pickup_location: emptyToNull(pickupLocation),
          dropoff_location: emptyToNull(dropoffLocation),
          meeting_point: emptyToNull(meetingPoint),
          vehicle_type: emptyToNull(vehicleType),
          driver_name: emptyToNull(driverName),
          driver_phone: emptyToNull(driverPhone),
        };
      } else if (booking.service_type === "activity") {
        const duration = numberOrNull(durationMinutes);
        if (Number.isNaN(duration)) {
          showWarningToast("Use a whole number for duration minutes.");
          setLoading(false);
          return;
        }
        nextDetails = {
          start_at: emptyToNull(startAt),
          end_at: emptyToNull(endAt),
          meeting_point: emptyToNull(meetingPoint),
          duration_minutes: duration,
          provider_name: emptyToNull(providerName),
          voucher_ref: emptyToNull(voucherRef),
        };
      }

      const previousDetails: Record<string, unknown> = {};
      for (const key of Object.keys(nextDetails)) {
        const raw = details[key];
        if (key === "check_in_time" || key === "check_out_time") {
          previousDetails[key] = emptyToNull(
            normalizeTimeOfDay(textFromUnknown(raw)),
          );
        } else if (key === "segments" && Array.isArray(raw)) {
          const prior = raw as Array<Record<string, unknown>>;
          const first = prior[0] ?? {};
          const priorSegment: Record<string, string> = {};
          const priorFrom = textFromUnknown(first.from).toUpperCase();
          const priorTo = textFromUnknown(first.to).toUpperCase();
          const priorDepart = normalizeTimeOfDay(
            textFromUnknown(first.depart_at),
          );
          const priorArrive = normalizeTimeOfDay(
            textFromUnknown(first.arrive_at),
          );
          const priorAirline = textFromUnknown(first.airline);
          const priorFlightNumber = textFromUnknown(
            first.flight_number,
          ).toUpperCase();
          const priorCabin = textFromUnknown(first.cabin);
          if (priorFrom) priorSegment.from = priorFrom;
          if (priorTo) priorSegment.to = priorTo;
          if (priorDepart) priorSegment.depart_at = priorDepart;
          if (priorArrive) priorSegment.arrive_at = priorArrive;
          if (priorAirline) priorSegment.airline = priorAirline;
          if (priorFlightNumber) {
            priorSegment.flight_number = priorFlightNumber;
          }
          if (priorCabin) priorSegment.cabin = priorCabin;
          previousDetails[key] =
            Object.keys(priorSegment).length > 0 || prior.length > 1
              ? [priorSegment, ...prior.slice(1)]
              : [];
        } else if (raw === "" || raw === undefined) {
          previousDetails[key] = null;
        } else {
          previousDetails[key] = raw ?? null;
        }
      }

      const dirtyDetails = dirtyPatch(nextDetails, previousDetails);
      const patch =
        Object.keys(dirtyDetails).length > 0
          ? { service_details: dirtyDetails }
          : {};

      await saveBookingPatch({
        bookingId: booking.id,
        updatedAt: booking.updated_at,
        patch,
        onClose,
        onSuccess,
      });
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }

  const title =
    booking.service_type === "hotel"
      ? "Edit stay details"
      : booking.service_type === "flight"
        ? "Edit flight details"
        : booking.service_type === "transfer"
          ? "Edit transfer details"
          : "Edit activity details";

  return (
    <SectionFormShell
      title={title}
      description="Type-specific timing and service fields stored on this reservation."
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {booking.service_type === "hotel" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Check-in time"
              htmlFor="edit-check-in"
              hint="Local time — pick from the clock (15-minute steps)."
            >
              <TimeOfDayInput
                id="edit-check-in"
                value={checkInTime}
                onChange={setCheckInTime}
                aria-label="Check-in time"
              />
            </Field>
            <Field
              label="Check-out time"
              htmlFor="edit-check-out"
              hint="Local time — pick from the clock (15-minute steps)."
            >
              <TimeOfDayInput
                id="edit-check-out"
                value={checkOutTime}
                onChange={setCheckOutTime}
                aria-label="Check-out time"
              />
            </Field>
          </div>
          <Field label="Room type" htmlFor="edit-room-type">
            <input
              id="edit-room-type"
              value={roomType}
              onChange={(event) => setRoomType(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meals included" htmlFor="edit-board">
              <div className="space-y-2">
                <select
                  id="edit-board"
                  value={boardCode}
                  onChange={(event) => {
                    setBoardCode(event.target.value);
                    if (event.target.value) setBoardCustomLabel("");
                  }}
                  className={cn(modalFieldClassName)}
                >
                  <option value="">Select standard meals…</option>
                  {BOARD_BASIS_PRESETS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </select>
                <input
                  id="edit-board-custom"
                  value={boardCustomLabel}
                  onChange={(event) => {
                    setBoardCustomLabel(event.target.value);
                    if (event.target.value.trim()) setBoardCode("");
                  }}
                  className={cn(modalFieldClassName)}
                  placeholder="Not in the list? Type another meal plan…"
                  aria-label="Custom meals included"
                />
              </div>
            </Field>
            <Field label="Booking rate" htmlFor="edit-rate-plan">
              <input
                id="edit-rate-plan"
                value={ratePlan}
                onChange={(event) => setRatePlan(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
          <Field label="Special requests" htmlFor="edit-special-requests">
            <textarea
              id="edit-special-requests"
              value={specialRequests}
              onChange={(event) => setSpecialRequests(event.target.value)}
              rows={2}
              className={cn(modalFieldClassName, "resize-y")}
            />
          </Field>
        </>
      ) : null}

      {booking.service_type === "flight" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="edit-flight-from">
              <input
                id="edit-flight-from"
                value={flightFrom}
                onChange={(event) =>
                  setFlightFrom(event.target.value.toUpperCase())
                }
                className={cn(modalFieldClassName)}
                placeholder="BLR"
                maxLength={8}
                autoCapitalize="characters"
              />
            </Field>
            <Field label="To" htmlFor="edit-flight-to">
              <input
                id="edit-flight-to"
                value={flightTo}
                onChange={(event) =>
                  setFlightTo(event.target.value.toUpperCase())
                }
                className={cn(modalFieldClassName)}
                placeholder="MLE"
                maxLength={8}
                autoCapitalize="characters"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Depart time"
              htmlFor="edit-depart-time"
              hint="Local time at origin"
            >
              <TimeOfDayInput
                id="edit-depart-time"
                value={departTime}
                onChange={setDepartTime}
                aria-label="Departure time"
              />
            </Field>
            <Field
              label="Arrive time"
              htmlFor="edit-arrive-time"
              hint="Local time at destination"
            >
              <TimeOfDayInput
                id="edit-arrive-time"
                value={arriveTime}
                onChange={setArriveTime}
                aria-label="Arrival time"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Airline" htmlFor="edit-airline">
              <input
                id="edit-airline"
                value={airline}
                onChange={(event) => setAirline(event.target.value)}
                className={cn(modalFieldClassName)}
                placeholder="Singapore Airlines"
              />
            </Field>
            <Field label="Flight number" htmlFor="edit-flight-number">
              <input
                id="edit-flight-number"
                value={flightNumber}
                onChange={(event) =>
                  setFlightNumber(event.target.value.toUpperCase())
                }
                className={cn(modalFieldClassName)}
                placeholder="SQ402"
                autoCapitalize="characters"
              />
            </Field>
            <Field label="Cabin" htmlFor="edit-cabin">
              <select
                id="edit-cabin"
                value={cabin}
                onChange={(event) => {
                  setCabin(event.target.value);
                  setBookingClass(event.target.value);
                }}
                className={cn(modalFieldClassName)}
              >
                <option value="">Select cabin…</option>
                <option value="economy">Economy</option>
                <option value="premium_economy">Premium economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </Field>
          </div>
          <Field label="Ticket number" htmlFor="edit-ticket-number">
            <input
              id="edit-ticket-number"
              value={ticketNumber}
              onChange={(event) => setTicketNumber(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </>
      ) : null}

      {booking.service_type === "transfer" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pickup" htmlFor="edit-pickup-at">
              <input
                id="edit-pickup-at"
                value={pickupAt}
                onChange={(event) => setPickupAt(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Drop-off" htmlFor="edit-dropoff-at">
              <input
                id="edit-dropoff-at"
                value={dropoffAt}
                onChange={(event) => setDropoffAt(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
          <Field label="Pickup location" htmlFor="edit-pickup-location">
            <input
              id="edit-pickup-location"
              value={pickupLocation}
              onChange={(event) => setPickupLocation(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <Field label="Drop-off location" htmlFor="edit-dropoff-location">
            <input
              id="edit-dropoff-location"
              value={dropoffLocation}
              onChange={(event) => setDropoffLocation(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meeting point" htmlFor="edit-meeting-point">
              <input
                id="edit-meeting-point"
                value={meetingPoint}
                onChange={(event) => setMeetingPoint(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Vehicle" htmlFor="edit-vehicle">
              <input
                id="edit-vehicle"
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Driver name" htmlFor="edit-driver-name">
              <input
                id="edit-driver-name"
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Driver phone" htmlFor="edit-driver-phone">
              <input
                id="edit-driver-phone"
                value={driverPhone}
                onChange={(event) => setDriverPhone(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
        </>
      ) : null}

      {booking.service_type === "activity" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start" htmlFor="edit-start-at">
              <input
                id="edit-start-at"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="End" htmlFor="edit-end-at">
              <input
                id="edit-end-at"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
          <Field label="Meeting point" htmlFor="edit-activity-meeting">
            <input
              id="edit-activity-meeting"
              value={meetingPoint}
              onChange={(event) => setMeetingPoint(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration (minutes)" htmlFor="edit-duration">
              <input
                id="edit-duration"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
            <Field label="Provider" htmlFor="edit-provider">
              <input
                id="edit-provider"
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
                className={cn(modalFieldClassName)}
              />
            </Field>
          </div>
          <Field label="Voucher ref" htmlFor="edit-voucher">
            <input
              id="edit-voucher"
              value={voucherRef}
              onChange={(event) => setVoucherRef(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </Field>
        </>
      ) : null}
    </SectionFormShell>
  );
}

type ContextFormProps = {
  detail: BookingDetail;
  ownerOptions: Array<{ id: string; name: string }>;
  loading: boolean;
  onClose: () => void;
  onAssignOwner?: (ownerId: string | null) => Promise<void>;
  onLinkTrip?: (tripId: string | null) => Promise<void>;
};

/** Context — trip link + account owner (dedicated actions, not generic PATCH). */
export function ContextForm({
  detail,
  ownerOptions,
  loading,
  onClose,
  onAssignOwner,
  onLinkTrip,
}: ContextFormProps) {
  const booking = detail.booking;
  const [tripId, setTripId] = useState(booking.trip_id ?? "");
  const [ownerId, setOwnerId] = useState(booking.relationship_owner_id ?? "");
  const [busy, setBusy] = useState(false);

  const owners = ownerSelectOptions(
    ownerOptions,
    booking.relationship_owner
      ? { id: booking.relationship_owner.id, name: booking.relationship_owner.name }
      : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const nextTrip = emptyToNull(tripId);
      const nextOwner = emptyToNull(ownerId);

      if (onLinkTrip && nextTrip !== booking.trip_id) {
        await onLinkTrip(nextTrip);
      }
      if (onAssignOwner && nextOwner !== booking.relationship_owner_id) {
        await onAssignOwner(nextOwner);
      }
      onClose();
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionFormShell
      title="Edit context"
      description="Link this reservation to a trip and set the account owner."
      loading={loading || busy}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field
        label="Trip ID"
        htmlFor="edit-trip-id"
        hint="Paste a trip UUID to link, or clear to unlink. Trip detail pages ship later."
      >
        <input
          id="edit-trip-id"
          value={tripId}
          onChange={(event) => setTripId(event.target.value)}
          className={cn(modalFieldClassName, "font-mono")}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </Field>
      <Field label="Account owner" htmlFor="edit-owner">
        <select
          id="edit-owner"
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          className={cn(modalFieldClassName)}
        >
          <option value="">Unassigned</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </select>
      </Field>
    </SectionFormShell>
  );
}

function ownerSelectOptions(
  options: Array<{ id: string; name: string }>,
  current: { id: string; name: string } | null,
): Array<{ id: string; name: string }> {
  if (!current?.id || options.some((option) => option.id === current.id)) {
    return options;
  }
  return [...options, current].sort((a, b) => a.name.localeCompare(b.name));
}
