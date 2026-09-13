import { parseBookingServiceDetails } from "@pureluxe/shared";

import {
  displayOrDash,
  formatBookingDate,
  formatBookingDateTime,
} from "./booking-format";

export type ServiceTimingIconKey =
  | "start"
  | "end"
  | "ref"
  | "pickup"
  | "dropoff";

export type ServiceTimingCard = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  icon: ServiceTimingIconKey;
};

export type ServiceDetailField = {
  key: string;
  label: string;
  value: string;
};

function formatTimeOfDay(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  if (!match) return value.trim();
  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${period}`;
}

function formatServiceDateTime(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatBookingDate(raw);
  if (/^([01]\d|2[0-3]):[0-5]\d/.test(raw) && !raw.includes("T")) {
    return formatTimeOfDay(raw);
  }
  if (Number.isFinite(Date.parse(raw))) return formatBookingDateTime(raw);
  return raw;
}

function timeHint(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^([01]\d|2[0-3]):[0-5]\d/.test(raw) && !raw.includes("T")) {
    return formatTimeOfDay(raw);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dateWithTimeHint(
  dateValue: string | null | undefined,
  timeOrDateTime: string | null | undefined,
): { value: string; hint?: string } {
  const dateLabel = formatBookingDate(dateValue);
  const hint = timeHint(timeOrDateTime);
  if (dateLabel === "—" && timeOrDateTime?.trim()) {
    return { value: formatServiceDateTime(timeOrDateTime) };
  }
  return { value: dateLabel, hint };
}

type TimingInput = {
  serviceType: string;
  startDate: string | null;
  endDate: string | null;
  supplierRef: string | null;
  serviceDetails: Record<string, unknown> | null | undefined;
};

/** Service-aware schedule cards (dates from columns, times from service_details). */
export function resolveServiceTimingCards(
  input: TimingInput,
): ServiceTimingCard[] {
  const parsed = parseBookingServiceDetails(
    input.serviceType,
    input.serviceDetails ?? {},
  );
  const refCard: ServiceTimingCard = {
    key: "ref",
    label: "Supplier ref",
    value: input.supplierRef?.trim() || "Missing ref",
    icon: "ref",
  };

  if (parsed.serviceType === "hotel") {
    const checkIn = dateWithTimeHint(
      input.startDate,
      parsed.details.check_in_time,
    );
    const checkOut = dateWithTimeHint(
      input.endDate,
      parsed.details.check_out_time,
    );
    return [
      {
        key: "check_in",
        label: "Check-in",
        value: checkIn.value,
        hint: checkIn.hint
          ? `From ${checkIn.hint}`
          : checkIn.value !== "—"
            ? "Time not set"
            : undefined,
        icon: "start",
      },
      {
        key: "check_out",
        label: "Check-out",
        value: checkOut.value,
        hint: checkOut.hint
          ? `By ${checkOut.hint}`
          : checkOut.value !== "—"
            ? "Time not set"
            : undefined,
        icon: "end",
      },
      refCard,
    ];
  }

  if (parsed.serviceType === "flight") {
    const segments = parsed.details.segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    const depart = dateWithTimeHint(input.startDate, first?.depart_at);
    const arrive = dateWithTimeHint(
      input.endDate ?? input.startDate,
      last?.arrive_at ?? first?.arrive_at,
    );
    return [
      {
        key: "depart",
        label: "Depart",
        value: depart.value,
        hint:
          depart.hint ||
          [first?.from, first?.flight_number].filter(Boolean).join(" · ") ||
          "Time not set",
        icon: "start",
      },
      {
        key: "arrive",
        label: segments.length > 1 ? "Final arrival" : "Arrive",
        value: arrive.value,
        hint:
          arrive.hint ||
          [last?.to, last?.flight_number].filter(Boolean).join(" · ") ||
          "Time not set",
        icon: "end",
      },
      refCard,
    ];
  }

  if (parsed.serviceType === "transfer") {
    const pickup = dateWithTimeHint(input.startDate, parsed.details.pickup_at);
    const dropoff = dateWithTimeHint(
      input.endDate ?? input.startDate,
      parsed.details.dropoff_at,
    );
    return [
      {
        key: "pickup",
        label: "Pickup",
        value: pickup.value,
        hint:
          pickup.hint ||
          parsed.details.pickup_location?.trim() ||
          "Time not set",
        icon: "pickup",
      },
      {
        key: "dropoff",
        label: "Drop-off",
        value: dropoff.value,
        hint:
          dropoff.hint ||
          parsed.details.dropoff_location?.trim() ||
          "Time not set",
        icon: "dropoff",
      },
      refCard,
    ];
  }

  if (parsed.serviceType === "activity") {
    const start = dateWithTimeHint(input.startDate, parsed.details.start_at);
    const end = dateWithTimeHint(
      input.endDate ?? input.startDate,
      parsed.details.end_at,
    );
    return [
      {
        key: "starts",
        label: "Starts",
        value: start.value,
        hint:
          start.hint ||
          parsed.details.meeting_point?.trim() ||
          "Time not set",
        icon: "start",
      },
      {
        key: "ends",
        label: "Ends",
        value: end.value,
        hint:
          end.hint ??
          (parsed.details.duration_minutes
            ? `${parsed.details.duration_minutes} min`
            : "Time not set"),
        icon: "end",
      },
      refCard,
    ];
  }

  return [
    {
      key: "start",
      label: "Start",
      value: formatBookingDate(input.startDate),
      icon: "start",
    },
    {
      key: "end",
      label: "End",
      value: formatBookingDate(input.endDate),
      icon: "end",
    },
    refCard,
  ];
}

function field(
  key: string,
  label: string,
  value: string | null | undefined,
): ServiceDetailField | null {
  const shown = displayOrDash(value);
  if (shown === "—") return null;
  return { key, label, value: shown };
}

function collect(
  ...items: Array<ServiceDetailField | null>
): ServiceDetailField[] {
  return items.filter((item): item is ServiceDetailField => item != null);
}

/** Structured rows for the service-details section. */
export function listServiceDetailFields(
  serviceType: string,
  serviceDetails: Record<string, unknown> | null | undefined,
): ServiceDetailField[] {
  const parsed = parseBookingServiceDetails(
    serviceType,
    serviceDetails ?? {},
  );

  if (parsed.serviceType === "hotel") {
    const d = parsed.details;
    return collect(
      field(
        "check_in_time",
        "Check-in time",
        d.check_in_time ? formatTimeOfDay(d.check_in_time) : null,
      ),
      field(
        "check_out_time",
        "Check-out time",
        d.check_out_time ? formatTimeOfDay(d.check_out_time) : null,
      ),
      field("room_type", "Room type", d.room_type),
      field("board_basis", "Board basis", d.board_basis),
      field("rate_plan", "Rate plan", d.rate_plan),
      field("special_requests", "Special requests", d.special_requests),
    );
  }

  if (parsed.serviceType === "flight") {
    const d = parsed.details;
    const rows = collect(
      field("ticket_number", "Ticket number", d.ticket_number),
      field("booking_class", "Booking class", d.booking_class),
    );
    (d.segments ?? []).forEach((segment, index) => {
      const summary = [
        [segment.airline, segment.flight_number].filter(Boolean).join(" "),
        [segment.from, segment.to].filter(Boolean).join(" → "),
        segment.depart_at
          ? `Dep ${formatServiceDateTime(segment.depart_at)}`
          : null,
        segment.arrive_at
          ? `Arr ${formatServiceDateTime(segment.arrive_at)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      if (summary) {
        rows.push({
          key: `segment_${index}`,
          label: `Segment ${index + 1}`,
          value: summary,
        });
      }
    });
    return rows;
  }

  if (parsed.serviceType === "transfer") {
    const d = parsed.details;
    return collect(
      field(
        "pickup_at",
        "Pickup time",
        d.pickup_at ? formatServiceDateTime(d.pickup_at) : null,
      ),
      field("pickup_location", "Pickup location", d.pickup_location),
      field(
        "dropoff_at",
        "Drop-off time",
        d.dropoff_at ? formatServiceDateTime(d.dropoff_at) : null,
      ),
      field("dropoff_location", "Drop-off location", d.dropoff_location),
      field("meeting_point", "Meeting point", d.meeting_point),
      field("vehicle_type", "Vehicle", d.vehicle_type),
      field("driver_name", "Driver", d.driver_name),
      field("driver_phone", "Driver phone", d.driver_phone),
    );
  }

  if (parsed.serviceType === "activity") {
    const d = parsed.details;
    return collect(
      field(
        "start_at",
        "Start time",
        d.start_at ? formatServiceDateTime(d.start_at) : null,
      ),
      field(
        "end_at",
        "End time",
        d.end_at ? formatServiceDateTime(d.end_at) : null,
      ),
      field("meeting_point", "Meeting point", d.meeting_point),
      field(
        "duration_minutes",
        "Duration",
        d.duration_minutes != null ? `${d.duration_minutes} minutes` : null,
      ),
      field("provider_name", "Provider", d.provider_name),
      field("voucher_ref", "Voucher ref", d.voucher_ref),
    );
  }

  return [];
}
