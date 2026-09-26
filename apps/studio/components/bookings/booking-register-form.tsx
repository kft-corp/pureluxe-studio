"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LuArrowLeft, LuCheck, LuSearch } from "react-icons/lu";
import {
  BOOKING_CREATE_STATUSES,
  createBookingSchema,
} from "@pureluxe/shared";

import {
  ContentSection,
  CountryCombobox,
  CurrencyCombobox,
  PageStack,
  TimeOfDayInput,
  normalizeTimeOfDay,
  studioButtonClass,
  studioChipClass,
} from "@/components/ui";
import { modalFieldClassName } from "@/components/ui/modal";
import { createBooking } from "@/lib/api/bookings";
import { searchClients, type ClientSearchHit } from "@/lib/api/clients";
import {
  dayAfter,
  emptyToNull,
  fromDatetimeLocalValue,
  numberOrNull,
} from "@/lib/bookings/booking-edit-helpers";
import {
  formatBookingServiceType,
  formatBookingStatus,
  formatBookingChannel,
  formatFlightRoute,
  BOARD_BASIS_PRESETS,
  BOOKING_CHANNEL_PRESETS,
  nightsBetween,
  resolveBoardBasisFields,
} from "@/lib/bookings";
import type { RelationshipOwnerOption } from "@/lib/clients";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

/** Create form supports hotel + flight only for now. */
const BOOKING_CREATE_SERVICE_TYPES = ["hotel", "flight"] as const;

type RegisterField =
  | "service_type"
  | "client_id"
  | "title"
  | "hotel_name"
  | "city"
  | "country"
  | "start_date"
  | "end_date"
  | "num_rooms"
  | "num_adults"
  | "num_children"
  | "room_type"
  | "board_basis"
  | "board_basis_label"
  | "rate_plan"
  | "flight_from"
  | "flight_to"
  | "depart_time"
  | "arrive_time"
  | "airline"
  | "flight_number"
  | "cabin"
  | "supplier_name"
  | "supplier_ref"
  | "booking_channel"
  | "currency"
  | "cost_amount"
  | "sell_amount"
  | "commission_expected"
  | "status"
  | "cancellation_deadline"
  | "ticket_time_limit"
  | "relationship_owner_id"
  | "internal_notes"
  | "vip_flag";

type FieldErrors = Partial<Record<RegisterField, string>>;

function fieldErrorsFromIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in next) continue;
    if (key === "service_details") {
      const nested = issue.path[1];
      if (typeof nested === "string" && !(nested in next)) {
        next[nested as RegisterField] = issue.message;
      }
      continue;
    }
    next[key as RegisterField] = issue.message;
  }
  return next;
}

function RequiredMark() {
  return (
    <span className="ml-0.5 font-semibold text-red-600" aria-hidden>
      *
    </span>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required,
  error,
  children,
}: Readonly<{
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}>) {
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required ? <RequiredMark /> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function fieldControlClass(invalid: boolean) {
  return cn(
    modalFieldClassName,
    "min-w-0 max-w-full text-base sm:text-sm",
    invalid && "border-red-400/70 ring-2 ring-red-400/40",
  );
}

function FormSection({
  step,
  title,
  description,
  children,
}: Readonly<{
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-dark text-xs font-semibold text-on-dark"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 space-y-4 sm:pl-10">{children}</div>
    </section>
  );
}

/**
 * Manual / offline booking capture — log supplier confirmation fast.
 * Travellers and Confirm stay on the detail page.
 */
export function BookingRegisterForm({
  ownerOptions = [],
  defaultOwnerId = null,
}: Readonly<{
  ownerOptions?: RelationshipOwnerOption[];
  defaultOwnerId?: string | null;
}>) {
  const router = useRouter();

  const [serviceType, setServiceType] =
    useState<(typeof BOOKING_CREATE_SERVICE_TYPES)[number]>("hotel");
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientSearchHit[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchHit | null>(
    null,
  );

  const [title, setTitle] = useState("");
  const [titleCustomized, setTitleCustomized] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [numRooms, setNumRooms] = useState("1");
  const [numAdults, setNumAdults] = useState("2");
  const [numChildren, setNumChildren] = useState("");
  const [roomType, setRoomType] = useState("");
  const [boardCode, setBoardCode] = useState("");
  const [boardCustomLabel, setBoardCustomLabel] = useState("");
  const [ratePlan, setRatePlan] = useState("");
  const [flightFrom, setFlightFrom] = useState("");
  const [flightTo, setFlightTo] = useState("");
  const [departTime, setDepartTime] = useState("");
  const [arriveTime, setArriveTime] = useState("");
  const [sameDayArrive, setSameDayArrive] = useState(true);
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [cabin, setCabin] = useState("");
  const [vipFlag, setVipFlag] = useState(false);

  const [supplierName, setSupplierName] = useState("");
  const [supplierCustomized, setSupplierCustomized] = useState(false);
  const [supplierRef, setSupplierRef] = useState("");
  const [bookingChannel, setBookingChannel] = useState("offline");
  const [showPricing, setShowPricing] = useState(false);
  const [currency, setCurrency] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [commissionExpected, setCommissionExpected] = useState("");

  const [status, setStatus] = useState<(typeof BOOKING_CREATE_STATUSES)[number]>(
    "pending",
  );
  const [cancellationDeadline, setCancellationDeadline] = useState("");
  const [ticketTimeLimit, setTicketTimeLimit] = useState("");
  const [relationshipOwnerId, setRelationshipOwnerId] = useState(
    defaultOwnerId ?? "",
  );
  const [internalNotes, setInternalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isHotel = serviceType === "hotel";
  const isFlight = serviceType === "flight";
  const nights = nightsBetween(startDate, endDate);
  const flightRouteLabel = formatFlightRoute(flightFrom, flightTo) ?? "";
  const resolvedTitle = (
    title.trim() ||
    (isHotel ? hotelName.trim() : "") ||
    (isFlight ? flightRouteLabel : "")
  ).trim();
  const canSubmit =
    Boolean(selectedClient) && resolvedTitle.length > 0 && !loading;

  function syncFlightRouteTitle(nextFrom: string, nextTo: string) {
    if (titleCustomized) return;
    const route = formatFlightRoute(nextFrom, nextTo);
    setTitle(route ?? "");
    if (route) clearFieldError("title");
  }

  function clearFieldError(...fields: RegisterField[]) {
    setFieldErrors((current) => {
      let changed = false;
      const next = { ...current };
      for (const field of fields) {
        if (field in next) {
          delete next[field];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  function syncHotelName(next: string) {
    setHotelName(next);
    clearFieldError("hotel_name");
    if (!titleCustomized) {
      setTitle(next);
      clearFieldError("title");
    }
    if (!supplierCustomized) {
      setSupplierName(next);
      clearFieldError("supplier_name");
    }
  }

  useEffect(() => {
    if (selectedClient) return;
    const trimmed = clientQuery.trim();
    if (trimmed.length < 2) {
      setClientHits([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchingClients(true);
      void searchClients({ q: trimmed, limit: 8 })
        .then((response) => {
          if (!cancelled) setClientHits(response.data.clients);
        })
        .catch(() => {
          if (!cancelled) setClientHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearchingClients(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientQuery, selectedClient]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !selectedClient) return;

    if (isHotel && (!startDate || !endDate)) {
      setFieldErrors({
        ...(!startDate
          ? {
              start_date:
                "Add check-in so this stay appears in work queues.",
            }
          : {}),
        ...(!endDate ? { end_date: "Add check-out." } : {}),
      });
      return;
    }

    if (isFlight) {
      const missingRoute: FieldErrors = {
        ...(!flightFrom.trim()
          ? { flight_from: "Add the departure airport." }
          : {}),
        ...(!flightTo.trim()
          ? { flight_to: "Add the arrival airport." }
          : {}),
        ...(!startDate
          ? { start_date: "Add the departure date for this flight." }
          : {}),
        ...(!sameDayArrive && !endDate
          ? {
              end_date:
                "Add the arrival date, or check same-day arrival.",
            }
          : {}),
      };
      if (Object.keys(missingRoute).length > 0) {
        setFieldErrors(missingRoute);
        return;
      }
    }

    const rooms = numberOrNull(numRooms);
    const adults = numberOrNull(numAdults);
    const children = numberOrNull(numChildren);
    const cost = numberOrNull(costAmount);
    const sell = numberOrNull(sellAmount);
    const commission = numberOrNull(commissionExpected);

    if ([rooms, adults, children, cost, sell, commission].some((value) =>
      Number.isNaN(value),
    )) {
      setFieldErrors({
        ...(Number.isNaN(rooms) ? { num_rooms: "Use a whole number." } : {}),
        ...(Number.isNaN(adults) ? { num_adults: "Use a whole number." } : {}),
        ...(Number.isNaN(children)
          ? { num_children: "Use a whole number." }
          : {}),
        ...(Number.isNaN(cost) ? { cost_amount: "Enter a valid amount." } : {}),
        ...(Number.isNaN(sell) ? { sell_amount: "Enter a valid amount." } : {}),
        ...(Number.isNaN(commission)
          ? { commission_expected: "Enter a valid amount." }
          : {}),
      });
      return;
    }

    const serviceDetails: Record<string, unknown> = {};
    if (isHotel) {
      if (roomType.trim()) serviceDetails.room_type = roomType.trim();
      const board = resolveBoardBasisFields({
        code: boardCode,
        customLabel: boardCustomLabel,
      });
      if (board.board_basis) serviceDetails.board_basis = board.board_basis;
      if (board.board_basis_label) {
        serviceDetails.board_basis_label = board.board_basis_label;
      }
      if (ratePlan.trim()) serviceDetails.rate_plan = ratePlan.trim();
    }
    if (isFlight) {
      const from = flightFrom.trim().toUpperCase();
      const to = flightTo.trim().toUpperCase();
      const depart = normalizeTimeOfDay(departTime);
      const arrive = normalizeTimeOfDay(arriveTime);
      const segment: Record<string, string> = {};
      if (from) segment.from = from;
      if (to) segment.to = to;
      if (depart) segment.depart_at = depart;
      if (arrive) segment.arrive_at = arrive;
      if (airline.trim()) segment.airline = airline.trim();
      if (flightNumber.trim()) {
        segment.flight_number = flightNumber.trim().toUpperCase();
      }
      if (cabin.trim()) segment.cabin = cabin.trim();
      if (Object.keys(segment).length > 0) {
        serviceDetails.segments = [segment];
      }
      serviceDetails.trip_type = "oneway";
      if (cabin.trim()) serviceDetails.booking_class = cabin.trim();
    }

    const payload = {
      service_type: serviceType,
      client_id: selectedClient.id,
      title: resolvedTitle,
      relationship_owner_id: relationshipOwnerId || null,
      hotel_name: isHotel ? emptyToNull(hotelName || resolvedTitle) : null,
      city: isFlight ? null : emptyToNull(city),
      country: isFlight ? null : emptyToNull(country),
      start_date: emptyToNull(startDate),
      end_date: emptyToNull(
        isFlight && sameDayArrive && startDate
          ? startDate
          : endDate || (isFlight ? startDate : endDate),
      ),
      num_rooms: isHotel ? rooms : null,
      num_adults: adults,
      num_children: children,
      supplier_name: emptyToNull(
        supplierName ||
          (isHotel ? hotelName || resolvedTitle : "") ||
          (isFlight ? airline : ""),
      ),
      supplier_ref: emptyToNull(supplierRef),
      booking_channel: emptyToNull(bookingChannel),
      currency: emptyToNull(currency),
      cost_amount: cost,
      sell_amount: sell,
      commission_expected: commission,
      status,
      cancellation_deadline: emptyToNull(cancellationDeadline),
      ticket_time_limit: isFlight
        ? fromDatetimeLocalValue(ticketTimeLimit)
        : null,
      internal_notes: emptyToNull(internalNotes),
      vip_flag: vipFlag,
      ...(Object.keys(serviceDetails).length > 0
        ? { service_details: serviceDetails }
        : {}),
    };

    const parsed = createBookingSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromIssues(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const response = await createBooking(parsed.data);
      showOptionalSuccessToast(response.message);
      router.push(pageRoutes.booking(response.data.booking.id));
      router.refresh();
    } catch (error) {
      showApiError(error);
      setLoading(false);
    }
  }

  return (
    <PageStack className="min-w-0">
      <div className="min-w-0">
        <Link
          href={pageRoutes.bookings}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          All bookings
        </Link>
      </div>

      <ContentSection
        title="Log booking"
        description="Capture offline or orphan inventory from a supplier confirmation. Prefer Trip Builder Book when the stay is already planned."
        className="min-w-0"
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full min-w-0 max-w-2xl space-y-7 px-4 py-5 sm:space-y-8 sm:px-6 sm:py-7"
          noValidate
        >
          <p className="text-pretty text-xs leading-relaxed text-ink-muted">
            <span className="font-semibold text-red-600">*</span> Required ·
            Primary client is added as lead traveller. Add more guests and
            Confirm on the booking page after create.
          </p>

          <FormSection
            step={1}
            title="Who and what"
            description="Client and service type for the ledger row."
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">
                Service type
                <RequiredMark />
              </p>
              <div className="flex flex-wrap gap-2">
                {BOOKING_CREATE_SERVICE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setServiceType(type);
                      clearFieldError("service_type");
                      if (type === "hotel" && !numRooms.trim()) {
                        setNumRooms("1");
                      }
                      if (type === "flight") {
                        setSameDayArrive(true);
                        if (startDate) setEndDate(startDate);
                      }
                    }}
                    className={studioChipClass(serviceType === type)}
                  >
                    {formatBookingServiceType(type)}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Client"
              htmlFor="register-booking-client"
              required
              error={fieldErrors.client_id}
              hint={
                selectedClient
                  ? undefined
                  : "Search by name, email, or phone."
              }
            >
              {selectedClient ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {selectedClient.display_name}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {[selectedClient.email, selectedClient.phone]
                        .filter(Boolean)
                        .join(" · ") || selectedClient.tier.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientQuery("");
                      setClientHits([]);
                      clearFieldError("client_id");
                    }}
                    className={cn(
                      studioButtonClass("secondary", "sm"),
                      "w-full shrink-0 sm:w-auto",
                    )}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <LuSearch
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                      aria-hidden
                    />
                    <input
                      id="register-booking-client"
                      value={clientQuery}
                      onChange={(event) => {
                        setClientQuery(event.target.value);
                        clearFieldError("client_id");
                      }}
                      className={cn(
                        fieldControlClass(Boolean(fieldErrors.client_id)),
                        "pl-9",
                      )}
                      placeholder="Search clients…"
                      autoComplete="off"
                      autoFocus
                      aria-invalid={Boolean(fieldErrors.client_id)}
                    />
                  </div>
                  {searchingClients ? (
                    <p className="text-xs text-ink-muted">Searching…</p>
                  ) : null}
                  {clientHits.length > 0 ? (
                    <ul className="overflow-hidden rounded-lg border border-border/80 bg-surface-raised">
                      {clientHits.map((hit) => (
                        <li
                          key={hit.id}
                          className="border-b border-border/60 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(hit);
                              setClientQuery(hit.display_name);
                              setClientHits([]);
                              clearFieldError("client_id");
                            }}
                            className="flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                          >
                            <span className="min-w-0 truncate text-sm font-medium text-ink">
                              {hit.display_name}
                            </span>
                            <span className="min-w-0 truncate text-xs text-ink-muted">
                              {[hit.email, hit.phone].filter(Boolean).join(" · ") ||
                                hit.tier.label}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : clientQuery.trim().length >= 2 && !searchingClients ? (
                    <p className="text-xs text-ink-muted">
                      No clients match.{" "}
                      <Link
                        href={pageRoutes.clientNew}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        Register a client
                      </Link>{" "}
                      first.
                    </p>
                  ) : null}
                </div>
              )}
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Status</p>
              <div className="flex flex-wrap gap-2">
                {BOOKING_CREATE_STATUSES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setStatus(option);
                      clearFieldError("status");
                    }}
                    className={studioChipClass(status === option)}
                  >
                    {formatBookingStatus(option)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-muted">
                {status === "on_hold"
                  ? "On hold keeps the row visible until you Confirm or Cancel."
                  : "Stays pending until you Confirm on the booking page."}
              </p>
            </div>
          </FormSection>

          <FormSection
            step={2}
            title={isHotel ? "Stay" : isFlight ? "Flight" : "Service"}
            description={
              isHotel
                ? "Property, dates, and room from the confirmation."
                : isFlight
                  ? "Route, dates, and times from the ticket or PNR."
                  : "Title and timing for this inventory row."
            }
          >
            {isHotel ? (
              <Field
                label="Property"
                htmlFor="register-hotel-name"
                required
                error={fieldErrors.hotel_name || fieldErrors.title}
                hint="Drives the list title and supplier unless you override them."
              >
                <input
                  id="register-hotel-name"
                  value={hotelName}
                  onChange={(event) => syncHotelName(event.target.value)}
                  className={fieldControlClass(
                    Boolean(fieldErrors.hotel_name || fieldErrors.title),
                  )}
                  placeholder="Soneva Fushi"
                  required
                />
              </Field>
            ) : null}

            {isHotel ? (
              showCustomTitle ? (
                <Field
                  label="List title"
                  htmlFor="register-booking-title"
                  error={fieldErrors.title}
                  hint="Optional override when the list label should differ from the property."
                >
                  <input
                    id="register-booking-title"
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setTitleCustomized(true);
                      clearFieldError("title");
                    }}
                    className={fieldControlClass(Boolean(fieldErrors.title))}
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomTitle(true)}
                  className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Custom list title
                </button>
              )
            ) : null}

            {isFlight ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="From"
                  htmlFor="register-flight-from"
                  required
                  error={fieldErrors.flight_from}
                  hint="Airport / city code, e.g. BLR"
                >
                  <input
                    id="register-flight-from"
                    value={flightFrom}
                    onChange={(event) => {
                      const next = event.target.value.toUpperCase();
                      setFlightFrom(next);
                      syncFlightRouteTitle(next, flightTo);
                      clearFieldError("flight_from", "title");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.flight_from),
                    )}
                    placeholder="BLR"
                    maxLength={8}
                    autoCapitalize="characters"
                  />
                </Field>
                <Field
                  label="To"
                  htmlFor="register-flight-to"
                  required
                  error={fieldErrors.flight_to}
                  hint="Airport / city code, e.g. MLE"
                >
                  <input
                    id="register-flight-to"
                    value={flightTo}
                    onChange={(event) => {
                      const next = event.target.value.toUpperCase();
                      setFlightTo(next);
                      syncFlightRouteTitle(flightFrom, next);
                      clearFieldError("flight_to", "title");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.flight_to),
                    )}
                    placeholder="MLE"
                    maxLength={8}
                    autoCapitalize="characters"
                  />
                </Field>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={
                  isHotel
                    ? "Check-in"
                    : isFlight
                      ? "Departure date"
                      : "Start date"
                }
                htmlFor="register-start-date"
                required={isHotel || isFlight}
                error={fieldErrors.start_date}
              >
                <input
                  id="register-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStartDate(next);
                    clearFieldError("start_date", "end_date");
                    if (!next) return;
                    if (isHotel && endDate && next >= endDate) {
                      setEndDate(dayAfter(next));
                      return;
                    }
                    if (isFlight && sameDayArrive) {
                      setEndDate(next);
                      return;
                    }
                    if (!isHotel && endDate && next > endDate) {
                      setEndDate(next);
                    }
                  }}
                  className={fieldControlClass(Boolean(fieldErrors.start_date))}
                />
              </Field>
              <Field
                label={
                  isHotel
                    ? "Check-out"
                    : isFlight
                      ? "Arrival date"
                      : "End date"
                }
                htmlFor="register-end-date"
                required={isHotel}
                error={fieldErrors.end_date}
                hint={
                  isHotel && nights != null && nights > 0
                    ? `${nights} night${nights === 1 ? "" : "s"}`
                    : isFlight && sameDayArrive
                      ? "Same-day arrival"
                      : undefined
                }
              >
                <input
                  id="register-end-date"
                  type="date"
                  value={endDate}
                  min={
                    startDate
                      ? isHotel
                        ? dayAfter(startDate)
                        : startDate
                      : undefined
                  }
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    if (
                      isFlight &&
                      startDate &&
                      event.target.value === startDate
                    ) {
                      setSameDayArrive(true);
                    } else if (isFlight) {
                      setSameDayArrive(false);
                    }
                    clearFieldError("end_date");
                  }}
                  className={fieldControlClass(Boolean(fieldErrors.end_date))}
                />
              </Field>
            </div>

            {isFlight ? (
              <label className="flex items-start gap-2.5 text-sm leading-snug text-ink">
                <input
                  type="checkbox"
                  checked={sameDayArrive}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSameDayArrive(checked);
                    if (checked && startDate) {
                      setEndDate(startDate);
                      clearFieldError("end_date");
                    } else if (!checked && endDate && endDate === startDate) {
                      setEndDate("");
                      clearFieldError("end_date");
                    }
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-brand-dark focus:ring-brand-dark/30"
                />
                <span>
                  Arrival is the same day as departure
                  {!sameDayArrive && !endDate ? (
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      Pick an arrival date for overnight or multi-day journeys.
                    </span>
                  ) : null}
                </span>
              </label>
            ) : null}

            {isFlight ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Depart time"
                    htmlFor="register-depart-time"
                    error={fieldErrors.depart_time}
                    hint="Local time at origin"
                  >
                    <TimeOfDayInput
                      id="register-depart-time"
                      value={departTime}
                      onChange={(value) => {
                        setDepartTime(value);
                        clearFieldError("depart_time");
                      }}
                      aria-label="Departure time"
                      className="min-w-0 max-w-full text-base sm:text-sm"
                    />
                  </Field>
                  <Field
                    label="Arrive time"
                    htmlFor="register-arrive-time"
                    error={fieldErrors.arrive_time}
                    hint="Local time at destination"
                  >
                    <TimeOfDayInput
                      id="register-arrive-time"
                      value={arriveTime}
                      onChange={(value) => {
                        setArriveTime(value);
                        clearFieldError("arrive_time");
                      }}
                      aria-label="Arrival time"
                      className="min-w-0 max-w-full text-base sm:text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <Field
                    label="Airline"
                    htmlFor="register-airline"
                    error={fieldErrors.airline}
                  >
                    <input
                      id="register-airline"
                      value={airline}
                      onChange={(event) => {
                        setAirline(event.target.value);
                        clearFieldError("airline");
                      }}
                      className={fieldControlClass(Boolean(fieldErrors.airline))}
                      placeholder="Singapore Airlines"
                    />
                  </Field>
                  <Field
                    label="Flight number"
                    htmlFor="register-flight-number"
                    error={fieldErrors.flight_number}
                  >
                    <input
                      id="register-flight-number"
                      value={flightNumber}
                      onChange={(event) => {
                        setFlightNumber(event.target.value.toUpperCase());
                        clearFieldError("flight_number");
                      }}
                      className={fieldControlClass(
                        Boolean(fieldErrors.flight_number),
                      )}
                      placeholder="SQ402"
                      autoCapitalize="characters"
                    />
                  </Field>
                  <Field
                    label="Cabin"
                    htmlFor="register-cabin"
                    error={fieldErrors.cabin}
                  >
                    <select
                      id="register-cabin"
                      value={cabin}
                      onChange={(event) => {
                        setCabin(event.target.value);
                        clearFieldError("cabin");
                      }}
                      className={fieldControlClass(Boolean(fieldErrors.cabin))}
                    >
                      <option value="">Select cabin…</option>
                      <option value="economy">Economy</option>
                      <option value="premium_economy">Premium economy</option>
                      <option value="business">Business</option>
                      <option value="first">First</option>
                    </select>
                  </Field>
                </div>

                {showCustomTitle || titleCustomized ? (
                  <Field
                    label="List title"
                    htmlFor="register-booking-title"
                    error={fieldErrors.title}
                    hint="Defaults to From → To."
                  >
                    <input
                      id="register-booking-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setTitleCustomized(true);
                        clearFieldError("title");
                      }}
                      className={fieldControlClass(Boolean(fieldErrors.title))}
                    />
                  </Field>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCustomTitle(true)}
                    className="text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    Custom list title
                    {flightRouteLabel ? ` (${flightRouteLabel})` : ""}
                  </button>
                )}
              </>
            ) : null}

            {!isFlight ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="register-city" error={fieldErrors.city}>
                  <input
                    id="register-city"
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value);
                      clearFieldError("city");
                    }}
                    className={fieldControlClass(Boolean(fieldErrors.city))}
                    placeholder={isHotel ? "Malé" : undefined}
                  />
                </Field>
                <Field
                  label="Country"
                  htmlFor="register-country"
                  error={fieldErrors.country}
                >
                  <CountryCombobox
                    id="register-country"
                    value={country}
                    onChange={(value) => {
                      setCountry(value);
                      clearFieldError("country");
                    }}
                    placeholder="Search countries…"
                  />
                </Field>
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-4",
                isHotel ? "sm:grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              {isHotel ? (
                <Field
                  label="Rooms"
                  htmlFor="register-rooms"
                  error={fieldErrors.num_rooms}
                >
                  <input
                    id="register-rooms"
                    inputMode="numeric"
                    value={numRooms}
                    onChange={(event) => {
                      setNumRooms(event.target.value);
                      clearFieldError("num_rooms");
                    }}
                    className={fieldControlClass(Boolean(fieldErrors.num_rooms))}
                  />
                </Field>
              ) : null}
              <Field
                label="Adults"
                htmlFor="register-adults"
                error={fieldErrors.num_adults}
              >
                <input
                  id="register-adults"
                  inputMode="numeric"
                  value={numAdults}
                  onChange={(event) => {
                    setNumAdults(event.target.value);
                    clearFieldError("num_adults");
                  }}
                  className={fieldControlClass(Boolean(fieldErrors.num_adults))}
                />
              </Field>
              <Field
                label="Children"
                htmlFor="register-children"
                error={fieldErrors.num_children}
              >
                <input
                  id="register-children"
                  inputMode="numeric"
                  value={numChildren}
                  onChange={(event) => {
                    setNumChildren(event.target.value);
                    clearFieldError("num_children");
                  }}
                  className={fieldControlClass(Boolean(fieldErrors.num_children))}
                />
              </Field>
            </div>

            {isHotel ? (
              <>
                <Field
                  label="Room type"
                  htmlFor="register-room-type"
                  error={fieldErrors.room_type}
                >
                  <input
                    id="register-room-type"
                    value={roomType}
                    onChange={(event) => {
                      setRoomType(event.target.value);
                      clearFieldError("room_type");
                    }}
                    className={fieldControlClass(Boolean(fieldErrors.room_type))}
                    placeholder="Ocean villa, Deluxe twin…"
                  />
                </Field>
                <Field
                  label="Meals included"
                  htmlFor="register-board"
                  error={
                    fieldErrors.board_basis || fieldErrors.board_basis_label
                  }
                >
                  <div className="space-y-2">
                    <select
                      id="register-board"
                      value={boardCode}
                      onChange={(event) => {
                        setBoardCode(event.target.value);
                        if (event.target.value) setBoardCustomLabel("");
                        clearFieldError("board_basis", "board_basis_label");
                      }}
                      className={fieldControlClass(
                        Boolean(
                          fieldErrors.board_basis ||
                            fieldErrors.board_basis_label,
                        ),
                      )}
                    >
                      <option value="">Select standard meals…</option>
                      {BOARD_BASIS_PRESETS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label} ({option.code})
                        </option>
                      ))}
                    </select>
                    <input
                      id="register-board-custom"
                      value={boardCustomLabel}
                      onChange={(event) => {
                        setBoardCustomLabel(event.target.value);
                        if (event.target.value.trim()) setBoardCode("");
                        clearFieldError("board_basis", "board_basis_label");
                      }}
                      className={fieldControlClass(
                        Boolean(
                          fieldErrors.board_basis ||
                            fieldErrors.board_basis_label,
                        ),
                      )}
                      placeholder="Not in the list? Type another meal plan…"
                      aria-label="Custom meals included"
                    />
                  </div>
                </Field>
                <Field
                  label="Rate plan"
                  htmlFor="register-rate-plan"
                  error={fieldErrors.rate_plan}
                  hint="Optional code or plan name from the confirmation."
                >
                  <input
                    id="register-rate-plan"
                    value={ratePlan}
                    onChange={(event) => {
                      setRatePlan(event.target.value);
                      clearFieldError("rate_plan");
                    }}
                    className={fieldControlClass(Boolean(fieldErrors.rate_plan))}
                  />
                </Field>
              </>
            ) : null}
          </FormSection>

          <FormSection
            step={3}
            title="Confirmation"
            description="What the supplier sent — ref, free-cancel date, and channel."
          >
            <Field
              label={isFlight ? "PNR / confirmation" : "Confirmation / PNR"}
              htmlFor="register-ref"
              error={fieldErrors.supplier_ref}
              hint="Paste from the WhatsApp or email when you have it."
            >
              <input
                id="register-ref"
                value={supplierRef}
                onChange={(event) => {
                  setSupplierRef(event.target.value);
                  clearFieldError("supplier_ref");
                }}
                className={cn(
                  fieldControlClass(Boolean(fieldErrors.supplier_ref)),
                  "font-mono",
                )}
                placeholder={isFlight ? "ABC123" : "Hotel ref / booking ID"}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cancel deadline"
                htmlFor="register-cancel-deadline"
                error={fieldErrors.cancellation_deadline}
                hint="Powers the Cancel soon queue."
              >
                <input
                  id="register-cancel-deadline"
                  type="date"
                  value={cancellationDeadline}
                  onChange={(event) => {
                    setCancellationDeadline(event.target.value);
                    clearFieldError("cancellation_deadline");
                  }}
                  className={fieldControlClass(
                    Boolean(fieldErrors.cancellation_deadline),
                  )}
                />
              </Field>
              {isFlight ? (
                <Field
                  label="Ticket time limit"
                  htmlFor="register-ticket-ttl"
                  error={fieldErrors.ticket_time_limit}
                >
                  <input
                    id="register-ticket-ttl"
                    type="datetime-local"
                    value={ticketTimeLimit}
                    onChange={(event) => {
                      setTicketTimeLimit(event.target.value);
                      clearFieldError("ticket_time_limit");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.ticket_time_limit),
                    )}
                  />
                </Field>
              ) : (
                <Field
                  label="Supplier"
                  htmlFor="register-supplier"
                  error={fieldErrors.supplier_name}
                  hint={
                    isHotel
                      ? "Defaults to the property for direct hotel books."
                      : undefined
                  }
                >
                  <input
                    id="register-supplier"
                    value={supplierName}
                    onChange={(event) => {
                      setSupplierName(event.target.value);
                      setSupplierCustomized(true);
                      clearFieldError("supplier_name");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.supplier_name),
                    )}
                  />
                </Field>
              )}
            </div>

            {isFlight ? (
              <Field
                label="Supplier"
                htmlFor="register-supplier"
                error={fieldErrors.supplier_name}
              >
                <input
                  id="register-supplier"
                  value={supplierName}
                  onChange={(event) => {
                    setSupplierName(event.target.value);
                    setSupplierCustomized(true);
                    clearFieldError("supplier_name");
                  }}
                  className={fieldControlClass(
                    Boolean(fieldErrors.supplier_name),
                  )}
                  placeholder="Airline or consolidator"
                />
              </Field>
            ) : null}

            <Field
              label="Booking channel"
              htmlFor="register-channel"
              error={fieldErrors.booking_channel}
            >
              <select
                id="register-channel"
                value={bookingChannel}
                onChange={(event) => {
                  setBookingChannel(event.target.value);
                  clearFieldError("booking_channel");
                }}
                className={fieldControlClass(
                  Boolean(fieldErrors.booking_channel),
                )}
              >
                <option value="">Select channel…</option>
                {BOOKING_CHANNEL_PRESETS.map((option) => (
                  <option key={option} value={option}>
                    {formatBookingChannel(option)}
                  </option>
                ))}
              </select>
            </Field>
          </FormSection>

          <FormSection
            step={4}
            title="Commercial"
            description="Team-only pricing snapshot — guests never see these amounts."
          >
            {showPricing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Currency"
                  htmlFor="register-currency"
                  error={fieldErrors.currency}
                >
                  <CurrencyCombobox
                    id="register-currency"
                    value={currency}
                    onChange={(value) => {
                      setCurrency(value);
                      clearFieldError("currency");
                    }}
                  />
                </Field>
                <Field
                  label="Cost"
                  htmlFor="register-cost"
                  error={fieldErrors.cost_amount}
                >
                  <input
                    id="register-cost"
                    inputMode="decimal"
                    value={costAmount}
                    onChange={(event) => {
                      setCostAmount(event.target.value);
                      clearFieldError("cost_amount");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.cost_amount),
                    )}
                  />
                </Field>
                <Field
                  label="Sell"
                  htmlFor="register-sell"
                  error={fieldErrors.sell_amount}
                >
                  <input
                    id="register-sell"
                    inputMode="decimal"
                    value={sellAmount}
                    onChange={(event) => {
                      setSellAmount(event.target.value);
                      clearFieldError("sell_amount");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.sell_amount),
                    )}
                  />
                </Field>
                <Field
                  label="Expected commission"
                  htmlFor="register-commission"
                  error={fieldErrors.commission_expected}
                >
                  <input
                    id="register-commission"
                    inputMode="decimal"
                    value={commissionExpected}
                    onChange={(event) => {
                      setCommissionExpected(event.target.value);
                      clearFieldError("commission_expected");
                    }}
                    className={fieldControlClass(
                      Boolean(fieldErrors.commission_expected),
                    )}
                  />
                </Field>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPricing(true)}
                className={studioButtonClass("secondary", "sm")}
              >
                Add pricing
              </button>
            )}
          </FormSection>

          <FormSection
            step={5}
            title="Owner and notes"
            description="Mine scope and anything the team should see next."
          >
            <Field
              label="Account owner"
              htmlFor="register-owner"
              error={fieldErrors.relationship_owner_id}
              hint="Defaults to you — drives Mine scope."
            >
              <select
                id="register-owner"
                value={relationshipOwnerId}
                onChange={(event) => {
                  setRelationshipOwnerId(event.target.value);
                  clearFieldError("relationship_owner_id");
                }}
                className={fieldControlClass(
                  Boolean(fieldErrors.relationship_owner_id),
                )}
              >
                {!defaultOwnerId ? (
                  <option value="">Assign to me</option>
                ) : null}
                {ownerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Team notes"
              htmlFor="register-notes"
              hint="Private to Studio — paste WhatsApp or email snippets here."
              error={fieldErrors.internal_notes}
            >
              <textarea
                id="register-notes"
                value={internalNotes}
                onChange={(event) => {
                  setInternalNotes(event.target.value);
                  clearFieldError("internal_notes");
                }}
                rows={3}
                className={cn(
                  fieldControlClass(Boolean(fieldErrors.internal_notes)),
                  "resize-y",
                )}
                placeholder="Paste WhatsApp / email confirmation…"
              />
            </Field>

            <label className="flex items-start gap-2.5 text-sm leading-snug text-ink">
              <input
                type="checkbox"
                checked={vipFlag}
                onChange={(event) => setVipFlag(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-brand-dark focus:ring-brand-dark/30"
              />
              <span>Highlight as VIP ops flag</span>
            </label>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-5 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={pageRoutes.bookings}
              className={cn(
                studioButtonClass("secondary", "md"),
                "w-full justify-center sm:w-auto",
              )}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                studioButtonClass("primary", "md"),
                "inline-flex w-full items-center justify-center gap-1.5 sm:w-auto",
              )}
            >
              {loading ? (
                "Creating…"
              ) : (
                <>
                  <LuCheck className="h-3.5 w-3.5" aria-hidden />
                  Create booking
                </>
              )}
            </button>
          </div>
        </form>
      </ContentSection>
    </PageStack>
  );
}
