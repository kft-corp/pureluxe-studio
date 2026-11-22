import {
  deleteBookingTraveller,
  findActivePropertyById,
  findClientById,
  findOpenHotelBookingForTrip,
  findTripLineItemById,
  insertBooking,
  insertBookingAuditLogs,
  insertBookingTraveller,
  listBookingTravellers,
  listClientDocuments,
  replaceFamilyBookingMembers,
  updateBooking,
  updateBookingTraveller,
  type Property,
  type PropertyContract,
  type TripLineItem,
} from "@pureluxe/db";

import { resolveBoardBasisFields } from "@/lib/bookings/booking-board-basis";
import { nightsBetween } from "@/lib/bookings/booking-dates";

import { parseCancelByDate, parseCancelDays } from "../rates/build-rate-compare";
import {
  comboCancelHandoffLine,
  comboOccupancySegmentsFromRaw,
  comboPaymentHandoffLine,
  type ComboOccupancySegment,
} from "../rates/combo-occupancy-segments";
import { loadHotelStayFacts } from "../stays/hotel-contract-facts";
import { defaultRoomCount } from "../trip/resolve-dates";
import type { TripDetail, TripStaySnapshot } from "../trip/trip-detail";

const TRIP_BUILDER_NOTE_PREFIX =
  "Created from Trip Builder for this stay.";

const CONTRACT_CHANNEL: Record<PropertyContract["contract_type"], string> = {
  wholesale: "Contracted · Wholesale",
  package: "Contracted · Package",
  tactical: "Contracted · Tactical",
};

/**
 * Distribution / supplier brand for the commercial tab.
 * Extensible: add new rate_source_code → label pairs as suppliers come online.
 */
const SUPPLIER_BY_SOURCE: Record<string, string> = {
  gds_public: "Sabre",
  gds_negotiated: "Sabre",
  ota_bedbank: "Bedbank",
  wholesale: "Wholesale",
  offline_manual: "Pasted quote",
};

const CHANNEL_BY_SOURCE: Record<string, string> = {
  gds_public: "Public GDS · Sabre",
  gds_negotiated: "Negotiated GDS · Sabre",
  ota_bedbank: "Bedbank",
  wholesale: "Wholesale",
  offline_manual: "Pasted quote",
  offline_contracted: "Contracted",
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rateBasisLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "nightly" || value === "per_night") return "Nightly";
  if (value === "package") return "Package";
  if (value === "per_person") return "Per person";
  if (value === "per_stay") return "Per stay";
  return value.replaceAll("_", " ");
}

function sourceChannel(code: string | null): string | null {
  if (!code) return null;
  return CHANNEL_BY_SOURCE[code] ?? null;
}

/** HH:mm from Sabre ("3:00 PM") or 24h ("15:00") clock strings. */
function normalizeClock(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const ampm = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)\b/i.exec(text);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = ampm[2]!;
    const suffix = ampm[3]!.toUpperCase();
    if (!Number.isFinite(hours) || hours < 1 || hours > 12) return null;
    if (suffix === "AM") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }
  const match = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(text);
  if (!match) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function partyCountFromValue(value: unknown, allowZero = false): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!allowZero && amount <= 0) return null;
  return Math.floor(amount);
}

/** Party frozen on the quote line (extracted / raw), then stay, then defaults. */
function resolveParty(
  stay: TripStaySnapshot,
  line: TripLineItem | null,
): { rooms: number; adults: number | null; children: number | null } {
  const extracted = extractedRecord(line);
  const raw = rawFromLine(line);
  const meta =
    raw?.quote_meta && typeof raw.quote_meta === "object"
      ? (raw.quote_meta as Record<string, unknown>)
      : null;

  const rooms =
    partyCountFromValue(extracted?.rooms) ??
    partyCountFromValue(raw?.rooms) ??
    partyCountFromValue(meta?.rooms) ??
    (stay.rooms != null && stay.rooms > 0 ? stay.rooms : null) ??
    defaultRoomCount(stay.adults != null && stay.adults > 0 ? stay.adults : 2);

  const adults =
    partyCountFromValue(extracted?.adults) ??
    partyCountFromValue(raw?.adults) ??
    partyCountFromValue(meta?.adults) ??
    (stay.adults != null && stay.adults > 0 ? stay.adults : null);

  const children =
    partyCountFromValue(extracted?.children, true) ??
    partyCountFromValue(raw?.children, true) ??
    partyCountFromValue(meta?.children, true) ??
    (stay.children != null && stay.children >= 0 ? stay.children : null);

  return { rooms, adults, children };
}

/** Prefer rate dates on the chosen option when valid; else stay dates. */
function resolveStayDates(
  stay: TripStaySnapshot,
  line: TripLineItem | null,
): { start: string | null; end: string | null } {
  const extracted = extractedRecord(line);
  const rateIn = textValue(extracted?.check_in);
  const rateOut = textValue(extracted?.check_out);
  if (rateIn && rateOut && rateOut > rateIn) {
    return { start: rateIn, end: rateOut };
  }
  return { start: stay.check_in ?? null, end: stay.check_out ?? null };
}

/** Drop cancel/payment chips so meal plan stays clean on the booking. */
function cleanBoardLabel(board: string | null): string | null {
  if (!board?.trim()) return null;
  const parts = board
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !/^(non[\s-]?refund|free cancel|refundable|prepaid|deposit|guarantee|pay at hotel)\b/i.test(
          part,
        ),
    );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function resolveCancellationDeadline(
  cancellation: string | null,
  line: TripLineItem | null,
  checkIn: string | null,
): string | null {
  const absolute = parseCancelByDate(cancellation, rawFromLine(line));
  if (absolute) return absolute;
  const cancelDays = parseCancelDays(cancellation);
  if (checkIn && cancelDays != null) return addDaysIso(checkIn, -cancelDays);
  return null;
}

function lineInclusions(line: TripLineItem | null): string[] {
  if (!line || !Array.isArray(line.inclusions)) return [];
  return line.inclusions
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 12);
}

function extractedRecord(
  line: TripLineItem | null,
): Record<string, unknown> | null {
  const extracted = line?.extracted_json;
  if (!extracted || typeof extracted !== "object") return null;
  return extracted;
}

function roomFromLine(line: TripLineItem | null): string | null {
  const extracted = extractedRecord(line);
  const named = textValue(extracted?.room_name);
  if (named) return named;
  const subtitle = line?.subtitle?.trim();
  if (!subtitle) return null;
  const room = subtitle.split(" · ")[0]?.trim();
  if (!room || room === line?.property_name?.trim()) return null;
  return room;
}

function boardFromLine(line: TripLineItem | null): string | null {
  const extracted = extractedRecord(line);
  const board = cleanBoardLabel(textValue(extracted?.board));
  if (board) return board;
  const subtitle = line?.subtitle?.trim();
  if (!subtitle?.includes(" · ")) return null;
  return cleanBoardLabel(textValue(subtitle.split(" · ").slice(1).join(" · ")));
}

function rawFromLine(line: TripLineItem | null): Record<string, unknown> | null {
  const extracted = extractedRecord(line);
  const raw = extracted?.raw;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function contractIdFromLine(line: TripLineItem | null): string | null {
  return textValue(rawFromLine(line)?.contract_id);
}

function rateBasisFromLine(line: TripLineItem | null): string | null {
  const record = rawFromLine(line);
  if (!record) return null;
  return textValue(record.rate_basis) ?? textValue(record.cost_unit);
}

/** Live GDS fields from the chosen rate (mapped or Open — no property required). */
function gdsHandoffFromLine(line: TripLineItem | null): {
  isGds: boolean;
  hotelCode: string | null;
  hotelName: string | null;
  rateKey: string | null;
  bookingKey: string | null;
  ratePlanName: string | null;
  sourceLabel: string | null;
  openGds: boolean;
} {
  const code = line?.rate_source_code ?? null;
  const isGds = code === "gds_public" || code === "gds_negotiated";
  const raw = rawFromLine(line);
  const hotelCode = textValue(raw?.sabre_hotel_code);
  const hotelName =
    textValue(raw?.sabre_hotel_name) ?? textValue(line?.property_name);
  return {
    isGds,
    hotelCode,
    hotelName,
    rateKey: textValue(raw?.rate_key),
    bookingKey: textValue(raw?.booking_key),
    ratePlanName:
      textValue(raw?.rate_plan_name) ?? textValue(raw?.rate_plan_code),
    sourceLabel: sourceChannel(code),
    openGds: isGds && !line?.property_id,
  };
}

function addDaysIso(isoDate: string, deltaDays: number): string | null {
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  const next = new Date(ms + deltaDays * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function ratePlanLabel(
  line: TripLineItem | null,
  contract: PropertyContract | null,
  gds: ReturnType<typeof gdsHandoffFromLine>,
): string | null {
  if (gds.isGds) {
    const parts = [gds.sourceLabel, gds.ratePlanName].filter(
      (part): part is string => Boolean(part),
    );
    if (parts.length > 0) return parts.join(" · ").slice(0, 200);
  }
  const parts = [
    rateBasisLabel(rateBasisFromLine(line)),
    contract?.booking_code?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return parts.join(" · ").slice(0, 200);
}

function bookingChannel(
  property: Property | null,
  contract: PropertyContract | null,
  line: TripLineItem | null,
): string | null {
  const code = line?.rate_source_code ?? null;

  // Live GDS / bedbank / wholesale / paste — channel from rate source (supplier-aware).
  if (
    code === "gds_public" ||
    code === "gds_negotiated" ||
    code === "ota_bedbank" ||
    code === "wholesale" ||
    code === "offline_manual"
  ) {
    return sourceChannel(code);
  }

  if (contract || code === "offline_contracted") {
    const basis = rateBasisLabel(rateBasisFromLine(line));
    if (contract?.contract_type === "package" || basis === "Package") {
      return "Contracted · Package";
    }
    if (basis === "Nightly") return "Contracted · Nights";
    if (contract) return CONTRACT_CHANNEL[contract.contract_type];
    return "Contracted";
  }

  // Future / unknown sources: prefer explicit source map, then property commission channel.
  const fromSource = sourceChannel(code);
  if (fromSource) return fromSource;
  return property?.commission_channel?.trim() || null;
}

/**
 * Commercial supplier (distribution), not the hotel name.
 * GDS → Sabre; contracted → property/hotel; paste/bedbank/wholesale from map.
 * Override via raw.supplier_name when a future supplier needs a custom label.
 */
function supplierNameForBooking(
  line: TripLineItem | null,
  property: Property | null,
  hotelName: string,
): string {
  const raw = rawFromLine(line);
  const override = textValue(raw?.supplier_name) ?? textValue(raw?.supplier);
  if (override) return override;

  const code = line?.rate_source_code ?? null;
  if (code && SUPPLIER_BY_SOURCE[code]) return SUPPLIER_BY_SOURCE[code]!;

  if (code === "offline_contracted") {
    return property?.name?.trim() || hotelName;
  }

  return property?.name?.trim() || hotelName;
}

function commissionAmount(property: Property | null): number | null {
  const amount = property?.default_commission;
  if (amount == null) return null;
  const value = Number(amount);
  return Number.isFinite(value) ? value : null;
}

function setOrDelete(
  next: Record<string, unknown>,
  key: string,
  value: string | null,
) {
  if (value) next[key] = value;
  else delete next[key];
}

/** Keep ops-entered confirmation refs when Trip Builder refreshes segments. */
function mergeComboSegmentsWithExisting(
  segments: ComboOccupancySegment[],
  existing: Record<string, unknown> | null,
): ComboOccupancySegment[] {
  const prior = Array.isArray(existing?.gds_room_segments)
    ? (existing!.gds_room_segments as Array<Record<string, unknown>>)
    : [];
  return segments.map((segment, index) => {
    const match =
      prior.find(
        (row) =>
          textValue(row.rate_key) &&
          textValue(row.rate_key) === segment.rate_key,
      ) ?? prior[index];
    const confirmation =
      textValue(match?.confirmation_ref) ?? segment.confirmation_ref ?? null;
    return confirmation
      ? { ...segment, confirmation_ref: confirmation }
      : { ...segment, confirmation_ref: null };
  });
}

function serviceDetailsForStay(
  existing: Record<string, unknown> | null,
  line: TripLineItem | null,
  contract: PropertyContract | null,
  times: { checkIn: string | null; checkOut: string | null },
  paymentPolicy: string | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  if (times.checkIn) next.check_in_time = times.checkIn;
  if (times.checkOut) next.check_out_time = times.checkOut;
  if (!line) {
    delete next.room_type;
    delete next.board_basis;
    delete next.board_basis_label;
    delete next.rate_plan;
    delete next.gds_hotel_code;
    delete next.gds_hotel_name;
    delete next.gds_rate_source;
    delete next.gds_rate_key;
    delete next.gds_booking_key;
    delete next.payment_summary;
    delete next.gds_room_segments;
    return next;
  }

  const gds = gdsHandoffFromLine(line);
  const comboSegments = comboOccupancySegmentsFromRaw(rawFromLine(line));

  const room = roomFromLine(line);
  if (room) next.room_type = room;
  else delete next.room_type;

  const board = resolveBoardBasisFields({
    code: boardFromLine(line) ?? "",
    customLabel: "",
  });
  if (board.board_basis || board.board_basis_label) {
    next.board_basis = board.board_basis;
    next.board_basis_label = board.board_basis_label;
  } else {
    delete next.board_basis;
    delete next.board_basis_label;
  }

  const plan = ratePlanLabel(line, contract, gds);
  if (plan) next.rate_plan = plan;
  else delete next.rate_plan;

  if (gds.isGds) {
    setOrDelete(next, "gds_hotel_code", gds.hotelCode);
    setOrDelete(next, "gds_hotel_name", gds.hotelName);
    setOrDelete(next, "gds_rate_source", gds.sourceLabel);
    setOrDelete(next, "gds_booking_key", gds.bookingKey);

    if (comboSegments) {
      const merged = mergeComboSegmentsWithExisting(comboSegments, existing);
      next.gds_room_segments = merged;
      // Parent key is null on combos — point ops at per-room keys.
      const keys = merged
        .map((segment) => segment.rate_key)
        .filter((key): key is string => Boolean(key));
      setOrDelete(
        next,
        "gds_rate_key",
        keys.length > 0 ? `See room segments (${keys.length} keys)` : null,
      );
      setOrDelete(next, "payment_summary", comboPaymentHandoffLine(merged));
    } else {
      delete next.gds_room_segments;
      setOrDelete(next, "gds_rate_key", gds.rateKey);
      setOrDelete(next, "payment_summary", paymentPolicy);
    }
  } else {
    delete next.gds_hotel_code;
    delete next.gds_hotel_name;
    delete next.gds_rate_source;
    delete next.gds_rate_key;
    delete next.gds_booking_key;
    delete next.payment_summary;
    delete next.gds_room_segments;
  }

  return next;
}

function formatSegmentBookLines(
  segments: ComboOccupancySegment[],
  currency: string | null,
): string[] {
  return segments.map((segment, index) => {
    const bits = [
      `Room ${index + 1} — ${segment.label}`,
      segment.board ? `Meal: ${segment.board}` : null,
      segment.cancellation_summary
        ? `Cancel: ${segment.cancellation_summary}`
        : null,
      segment.payment_summary ? `Payment: ${segment.payment_summary}` : null,
      segment.cost_internal != null
        ? `Cost: ${[currency, String(segment.cost_internal)].filter(Boolean).join(" ")}`
        : null,
      segment.rate_key ? `Rate key: ${segment.rate_key}` : null,
      segment.confirmation_ref
        ? `Confirmation: ${segment.confirmation_ref}`
        : "Confirmation: (add after offline book)",
    ].filter((bit): bit is string => Boolean(bit));
    return bits.join("\n  ");
  });
}

function tripBuilderNotes(input: {
  inclusions: string[];
  paymentPolicy: string | null;
  cancellation: string | null;
  recordNotes: string | null;
  line: TripLineItem | null;
  hotel: string;
  checkIn: string | null;
  checkOut: string | null;
  rooms: number | null;
  adults: number | null;
  children: number | null;
  cost: number | null;
  currency: string | null;
}): string {
  const gds = gdsHandoffFromLine(input.line);
  const room = roomFromLine(input.line);
  const board = boardFromLine(input.line);
  const roomLine = [room, board].filter(Boolean).join(" · ");
  const comboSegments = comboOccupancySegmentsFromRaw(rawFromLine(input.line));

  const lines = [
    `${TRIP_BUILDER_NOTE_PREFIX} The sell stays on the trip.`,
  ];

  if (gds.isGds) {
    const bookLines = [
      gds.openGds
        ? "Book offline (Open GDS — not in PureLuxe hotel master):"
        : "Book offline (GDS):",
      comboSegments
        ? "This option is two (or more) room reservations — book each room below, then store each confirmation."
        : null,
      `Hotel: ${gds.hotelName ?? input.hotel}`,
      gds.hotelCode ? `GDS hotel code: ${gds.hotelCode}` : null,
      gds.sourceLabel ? `Rate source: ${gds.sourceLabel}` : null,
      roomLine ? `Option: ${roomLine}` : null,
      input.checkIn && input.checkOut
        ? `Dates: ${input.checkIn} → ${input.checkOut}`
        : null,
      input.adults != null || input.children != null || input.rooms != null
        ? `Party: ${input.adults ?? "—"} adults, ${input.children ?? "—"} children, ${input.rooms ?? "—"} room(s)`
        : null,
      input.cost != null
        ? `Stay cost (all rooms): ${input.currency ?? ""} ${input.cost}`.trim()
        : null,
    ].filter((line): line is string => Boolean(line));

    if (comboSegments) {
      bookLines.push("", "Per room:");
      bookLines.push(...formatSegmentBookLines(comboSegments, input.currency));
    } else {
      bookLines.push(
        ...[
          input.cancellation ? `Cancel: ${input.cancellation}` : null,
          input.paymentPolicy ? `Payment: ${input.paymentPolicy}` : null,
          gds.rateKey ? `Rate key: ${gds.rateKey}` : null,
          gds.bookingKey ? `Booking key: ${gds.bookingKey}` : null,
        ].filter((line): line is string => Boolean(line)),
      );
    }
    lines.push(bookLines.join("\n"));
  } else {
    if (input.paymentPolicy) {
      lines.push(`Payment: ${input.paymentPolicy}`);
    }
  }

  if (input.inclusions.length > 0) {
    lines.push(`Includes: ${input.inclusions.join(", ")}.`);
  }
  if (input.recordNotes) lines.push(input.recordNotes);
  return lines.join("\n\n");
}

function shouldRefreshNotes(existing: string | null): boolean {
  const text = existing?.trim() ?? "";
  return text.length === 0 || text.startsWith(TRIP_BUILDER_NOTE_PREFIX);
}

async function passportOnFile(clientId: string) {
  const documents = await listClientDocuments(clientId, { limit: 20 });
  const passports = documents.filter(
    (document) => document.document_type === "passport" && document.status !== "rejected",
  );
  return passports.find((document) => document.status === "verified") ?? passports[0] ?? null;
}

/** Copy the trip's named clients onto the booking, including a passport already on the client. */
async function syncBookingTravellers(bookingId: string, detail: TripDetail): Promise<string[]> {
  const people =
    detail.travellers.length > 0
      ? detail.travellers
      : detail.client
        ? [
            {
              client_id: detail.client.id,
              display_name: detail.client.display_name,
              role: "primary" as const,
              party_role: "adult" as const,
            },
          ]
        : [];
  const existing = await listBookingTravellers(bookingId);
  const wanted = new Set(people.map((person) => person.client_id));
  for (const row of existing) {
    if (row.client_id && !wanted.has(row.client_id)) {
      await deleteBookingTraveller({ id: row.id, booking_id: bookingId });
    }
  }

  const names: string[] = [];
  for (const person of people) {
    const client = await findClientById(person.client_id);
    const passport = await passportOnFile(person.client_id);
    const fullName =
      client?.legal_name?.trim() || client?.display_name?.trim() || person.display_name.trim();
    const role =
      person.role === "primary"
        ? "lead"
        : person.party_role === "infant"
          ? "infant"
          : person.party_role === "child"
            ? "child"
            : "adult";
    const current = existing.find((row) => row.client_id === person.client_id);
    const dateOfBirth =
      passport?.date_of_birth ?? client?.date_of_birth ?? null;
    const gender = client?.gender ?? null;
    const passportFields = passport
      ? {
          date_of_birth: dateOfBirth,
          passport_number: passport.document_number,
          passport_nationality: passport.issuing_country ?? client?.nationality ?? null,
          passport_expiry: passport.expiry_date,
        }
      : {
          date_of_birth: dateOfBirth,
          passport_number: null as string | null,
          passport_nationality: client?.nationality ?? null,
          passport_expiry: null as string | null,
        };
    if (current) {
      await updateBookingTraveller({
        id: current.id,
        booking_id: bookingId,
        client_id: person.client_id,
        title: client?.title ?? current.title,
        full_name: fullName,
        gender: gender ?? current.gender,
        role,
        ...passportFields,
      });
    } else if (fullName) {
      await insertBookingTraveller({
        booking_id: bookingId,
        client_id: person.client_id,
        title: client?.title ?? null,
        full_name: fullName,
        gender,
        role,
        date_of_birth: passportFields.date_of_birth,
        passport_number: passportFields.passport_number,
        passport_nationality: passportFields.passport_nationality,
        passport_expiry: passportFields.passport_expiry,
      });
    }
    if (fullName) names.push(fullName);
  }

  await replaceFamilyBookingMembers(
    bookingId,
    people.map((person) => person.client_id),
  );
  return names;
}

function staysOf(detail: TripDetail): TripStaySnapshot[] {
  if (detail.stays.length > 0) return detail.stays;
  return detail.stay ? [detail.stay] : [];
}

/**
 * Keep one pending hotel booking per stay that already has a hotel.
 * The client price stays on the trip. A confirmed or completed booking is left as-is.
 */
export async function syncTripHotelBooking(
  detail: TripDetail,
  actor: { memberId: string },
): Promise<boolean> {
  const clientId = detail.client?.id ?? detail.trip.primary_client_id ?? null;

  const stays = staysOf(detail);
  const targets = stays.length > 0 ? stays : [];
  let wrote = false;
  for (const stay of targets) {
    const selected =
      detail.rates.candidates.find(
        (rate) => rate.selected && rate.leg_id === stay.leg_id,
      ) ?? null;
    const ok = await syncOneStay(detail, actor, clientId, stay, selected);
    wrote = wrote || ok;
  }
  return wrote;
}

async function syncOneStay(
  detail: TripDetail,
  actor: { memberId: string },
  clientId: string | null,
  stay: TripStaySnapshot,
  selected: TripDetail["rates"]["selected"],
): Promise<boolean> {
  // A hotel name on the stay is not a booking. The booking starts when one room is chosen.
  if (!selected) return false;
  const hotel = selected.property_name?.trim() || stay.property_name?.trim() || "";
  if (!hotel) return false;

  const existing = await findOpenHotelBookingForTrip(detail.trip.id, stay.leg_id);
  if (existing && (existing.status === "confirmed" || existing.status === "completed")) {
    return false;
  }
  if (!clientId && !existing) return false;

  const line = await findTripLineItemById(selected.id);
  const { start, end } = resolveStayDates(stay, line);
  const propertyId = line?.property_id ?? stay.property_id ?? null;
  const facts = propertyId
    ? await loadHotelStayFacts({
        propertyId,
        checkIn: start,
        checkOut: end,
        contractId: contractIdFromLine(line),
      })
    : null;
  const property = facts?.property ?? (propertyId ? await findActivePropertyById(propertyId) : null);
  const contract = facts?.contract ?? null;
  const gds = gdsHandoffFromLine(line);
  const tax =
    selected?.tax_percentage == null ? null : Number(selected.tax_percentage);
  const commission = commissionAmount(property);
  const inclusions = lineInclusions(line);
  const comboSegments = comboOccupancySegmentsFromRaw(rawFromLine(line));
  const paymentPolicy = comboSegments
    ? comboPaymentHandoffLine(comboSegments)
    : textValue(line?.payment_policy) ?? textValue(selected?.payment_policy);
  const selectedPolicy = selected?.cancellation_policy?.trim() || null;
  const fromContract = facts?.cancellationLines.join("\n") || null;
  const cancellation = comboSegments
    ? comboCancelHandoffLine(comboSegments) ||
      textValue(line?.cancellation_policy) ||
      selectedPolicy ||
      fromContract ||
      null
    : textValue(line?.cancellation_policy) || selectedPolicy || fromContract || null;
  const cancellationDeadline = resolveCancellationDeadline(cancellation, line, start);
  const hotelName = gds.hotelName?.trim() || hotel;
  const party = resolveParty(stay, line);
  const rawTimes = rawFromLine(line);
  const checkInTime =
    normalizeClock(rawTimes?.hotel_check_in_time) ?? facts?.checkInTime ?? null;
  const checkOutTime =
    normalizeClock(rawTimes?.hotel_check_out_time) ?? facts?.checkOutTime ?? null;
  const notes = tripBuilderNotes({
    inclusions,
    paymentPolicy,
    cancellation,
    recordNotes: facts?.recordNotes ?? null,
    line,
    hotel: hotelName,
    checkIn: start,
    checkOut: end,
    rooms: party.rooms,
    adults: party.adults,
    children: party.children,
    cost: selected?.cost_internal ?? null,
    currency: selected?.currency ?? null,
  });
  const fields = {
    title: hotelName,
    client_id: clientId,
    trip_id: detail.trip.id,
    trip_leg_id: stay.leg_id,
    trip_line_item_id: selected?.id ?? null,
    property_id: propertyId,
    hotel_name: hotelName,
    city: property?.city?.trim() || stay.city || null,
    country: property?.country ?? null,
    chain: property?.chain?.trim() || null,
    start_date: start,
    end_date: end,
    nights: nightsBetween(start, end),
    num_rooms: party.rooms,
    num_adults: party.adults,
    num_children: party.children,
    supplier_name: supplierNameForBooking(line, property, hotelName),
    booking_channel: bookingChannel(property, contract ?? null, line),
    currency: selected?.currency ?? null,
    cost_amount: selected?.cost_internal ?? null,
    sell_amount:
      selected?.sell_amount ??
      (existing?.trip_line_item_id === selected?.id ? existing?.sell_amount ?? null : null),
    tax_percentage: tax != null && Number.isFinite(tax) ? tax : null,
    ...(commission != null ? { commission_expected: commission } : {}),
    cancellation_policy: cancellation,
    cancellation_deadline: cancellationDeadline,
    relationship_owner_id: detail.trip.relationship_owner_id ?? actor.memberId,
    service_details: serviceDetailsForStay(
      existing?.service_details ?? null,
      line,
      contract,
      {
        checkIn: checkInTime,
        checkOut: checkOutTime,
      },
      paymentPolicy,
    ),
    ...(existing == null || shouldRefreshNotes(existing.internal_notes)
      ? { internal_notes: notes }
      : {}),
  };

  if (existing) {
    await updateBooking({ id: existing.id, ...fields });
    await syncBookingTravellers(existing.id, detail);
    await insertBookingAuditLogs([
      {
        booking_id: existing.id,
        action: "updated",
        field_name: "cost_amount",
        old_value: existing.cost_amount == null ? null : String(existing.cost_amount),
        new_value: fields.cost_amount == null ? null : String(fields.cost_amount),
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "trip_builder", trip_id: detail.trip.id },
      },
      ...(String(existing.sell_amount ?? "") !== String(fields.sell_amount ?? "")
        ? [
            {
              booking_id: existing.id,
              action: "updated" as const,
              field_name: "sell_amount",
              old_value: existing.sell_amount == null ? null : String(existing.sell_amount),
              new_value: fields.sell_amount == null ? null : String(fields.sell_amount),
              performed_by: "team" as const,
              team_member_id: actor.memberId,
              metadata: { source: "trip_builder", trip_id: detail.trip.id },
            },
          ]
        : []),
    ]);
    return true;
  }

  const booking = await insertBooking({
    ...fields,
    service_type: "hotel",
    booked_by_id: actor.memberId,
    source: "trip_builder",
    supplier_ref: null,
    commission_expected: commission,
    status: "pending",
    confirmed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    ticket_time_limit: null,
    amended_from_id: null,
    guest_visible: false,
    guest_notes: null,
    internal_notes: notes,
    confirmation_file_path: null,
    vip_flag: false,
    special_occasion: null,
  });

  const names = await syncBookingTravellers(booking.id, detail);

  await insertBookingAuditLogs([
    {
      booking_id: booking.id,
      action: "created",
      field_name: null,
      old_value: null,
      new_value: null,
      performed_by: "team",
      team_member_id: actor.memberId,
      metadata: {
        source: "trip_builder",
        trip_id: detail.trip.id,
        service_type: "hotel",
      },
    },
    {
      booking_id: booking.id,
      action: "traveller_created",
      field_name: "travellers",
      old_value: null,
      new_value: names.join(", ") || null,
      performed_by: "team",
      team_member_id: actor.memberId,
      metadata: { source: "trip_builder" },
    },
  ]);

  return true;
}
