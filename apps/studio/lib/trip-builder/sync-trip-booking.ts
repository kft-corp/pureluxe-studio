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

import { loadHotelStayFacts } from "./hotel-contract-facts";
import type { TripDetail, TripStaySnapshot } from "./trip-detail";

const TRIP_BUILDER_NOTE_PREFIX =
  "Created from Trip Builder for this stay.";

const CONTRACT_CHANNEL: Record<PropertyContract["contract_type"], string> = {
  wholesale: "Wholesale",
  package: "Package",
  tactical: "Tactical",
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
  if (code === "offline_contracted") return "Contracted";
  if (code === "offline_manual") return "Pasted quote";
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
  const board = textValue(extracted?.board);
  if (board) return board;
  const subtitle = line?.subtitle?.trim();
  if (!subtitle?.includes(" · ")) return null;
  return textValue(subtitle.split(" · ").slice(1).join(" · "));
}

function contractIdFromLine(line: TripLineItem | null): string | null {
  const extracted = extractedRecord(line);
  const raw = extracted?.raw;
  if (!raw || typeof raw !== "object") return null;
  return textValue((raw as Record<string, unknown>).contract_id);
}

function rateBasisFromLine(line: TripLineItem | null): string | null {
  const extracted = extractedRecord(line);
  const raw = extracted?.raw;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return textValue(record.rate_basis) ?? textValue(record.cost_unit);
}

function ratePlanLabel(
  line: TripLineItem | null,
  contract: PropertyContract | null,
): string | null {
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
  const fromProperty = property?.commission_channel?.trim();
  if (fromProperty) return fromProperty;
  if (contract) return CONTRACT_CHANNEL[contract.contract_type];
  return sourceChannel(line?.rate_source_code ?? null);
}

function commissionAmount(property: Property | null): number | null {
  const amount = property?.default_commission;
  if (amount == null) return null;
  const value = Number(amount);
  return Number.isFinite(value) ? value : null;
}

function serviceDetailsForStay(
  existing: Record<string, unknown> | null,
  line: TripLineItem | null,
  contract: PropertyContract | null,
  times: { checkIn: string | null; checkOut: string | null },
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  if (times.checkIn) next.check_in_time = times.checkIn;
  if (times.checkOut) next.check_out_time = times.checkOut;
  if (!line) {
    delete next.room_type;
    delete next.board_basis;
    delete next.board_basis_label;
    delete next.rate_plan;
    return next;
  }

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

  const plan = ratePlanLabel(line, contract);
  if (plan) next.rate_plan = plan;
  else delete next.rate_plan;

  return next;
}

function tripBuilderNotes(
  inclusions: string[],
  paymentPolicy: string | null,
  recordNotes: string | null,
): string {
  const lines = [
    `${TRIP_BUILDER_NOTE_PREFIX} The client price stays on the trip.`,
  ];
  if (inclusions.length > 0) {
    lines.push(`Includes: ${inclusions.join(", ")}.`);
  }
  if (paymentPolicy) {
    lines.push(`Payment: ${paymentPolicy}`);
  }
  if (recordNotes) lines.push(recordNotes);
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
      person.role === "primary" ? "lead" : person.party_role === "child" ? "child" : "adult";
    const current = existing.find((row) => row.client_id === person.client_id);
    const passportFields = passport
      ? {
          date_of_birth: passport.date_of_birth,
          passport_number: passport.document_number,
          passport_nationality: passport.issuing_country ?? client?.nationality ?? null,
          passport_expiry: passport.expiry_date,
        }
      : null;
    if (current) {
      await updateBookingTraveller({
        id: current.id,
        booking_id: bookingId,
        client_id: person.client_id,
        title: client?.title ?? current.title,
        full_name: fullName,
        role,
        ...(passportFields ?? {}),
      });
    } else if (fullName) {
      await insertBookingTraveller({
        booking_id: bookingId,
        client_id: person.client_id,
        title: client?.title ?? null,
        full_name: fullName,
        gender: null,
        role,
        date_of_birth: passportFields?.date_of_birth ?? null,
        passport_number: passportFields?.passport_number ?? null,
        passport_nationality: passportFields?.passport_nationality ?? client?.nationality ?? null,
        passport_expiry: passportFields?.passport_expiry ?? null,
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

  const start = stay.check_in ?? null;
  const end = stay.check_out ?? null;
  const line = await findTripLineItemById(selected.id);
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
  const tax =
    selected?.tax_percentage == null ? null : Number(selected.tax_percentage);
  const commission = commissionAmount(property);
  const inclusions = lineInclusions(line);
  const paymentPolicy = textValue(line?.payment_policy);
  const notes = tripBuilderNotes(inclusions, paymentPolicy, facts?.recordNotes ?? null);
  const selectedPolicy = selected?.cancellation_policy?.trim() || null;
  const fromContract = facts?.cancellationLines.join("\n") || null;
  const cancellation = selectedPolicy || fromContract || null;
  const fields = {
    title: hotel,
    client_id: clientId,
    trip_id: detail.trip.id,
    trip_leg_id: stay.leg_id,
    trip_line_item_id: selected?.id ?? null,
    property_id: propertyId,
    hotel_name: hotel,
    city: property?.city?.trim() || stay.city || null,
    country: property?.country ?? null,
    chain: property?.chain?.trim() || null,
    start_date: start,
    end_date: end,
    nights: nightsBetween(start, end),
    num_rooms: stay.rooms ?? null,
    num_adults: stay.adults ?? null,
    num_children: stay.children ?? null,
    supplier_name: property?.name?.trim() || null,
    booking_channel: bookingChannel(property, contract ?? null, line),
    currency: selected?.currency ?? null,
    cost_amount: selected?.cost_internal ?? null,
    sell_amount:
      selected?.sell_amount ??
      (existing?.trip_line_item_id === selected?.id ? existing?.sell_amount ?? null : null),
    tax_percentage: tax != null && Number.isFinite(tax) ? tax : null,
    ...(commission != null ? { commission_expected: commission } : {}),
    cancellation_policy: cancellation,
    relationship_owner_id: detail.trip.relationship_owner_id ?? actor.memberId,
    service_details: serviceDetailsForStay(
      existing?.service_details ?? null,
      line,
      contract,
      {
        checkIn: facts?.checkInTime ?? null,
        checkOut: facts?.checkOutTime ?? null,
      },
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
    cancellation_deadline: null,
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
