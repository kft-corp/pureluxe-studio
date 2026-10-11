import {
  findClientById,
  findClientHealth,
  findClientTierById,
  findOpenHotelBookingForTrip,
  listClientDocuments,
  listClientPreferences,
  type ClientDocument,
  type ClientHealthProfile,
  type ClientPreference,
} from "@pureluxe/db";

import { clearRateSearchPack } from "@/lib/rates/rate-search-pack";

import { answerAtlasStay } from "./atlas-stay";
import { getTripDetail } from "./get-trip-detail";
import { loadHotelStayFacts } from "./hotel-contract-facts";
import type { TripDetail, TripStaySnapshot } from "./trip-detail";

/** How long a pack is reused. A write clears it sooner. */
const PACK_TTL_MS = 30 * 60 * 1000;

type TripPack = {
  expiresAt: number;
  notes: string;
  placeNames: string[];
};

const packs = new Map<string, TripPack>();

/**
 * Drop the cached pack after the trip, client, stay, or rate changes.
 * The next question loads a full pack from the database.
 */
export function clearTripDossier(tripId: string) {
  packs.delete(tripId);
  clearRateSearchPack(tripId);
}

/**
 * Everything on file for this trip.
 * A warm cache is returned as-is. A miss or an expired pack is loaded from the database.
 */
export async function getTripDossier(
  tripId: string,
  actor: { memberId: string },
  detail?: TripDetail,
): Promise<{ notes: string; placeNames: string[] }> {
  const hit = packs.get(tripId);
  if (hit && hit.expiresAt > Date.now()) {
    return { notes: hit.notes, placeNames: hit.placeNames };
  }
  const loaded = await loadTripDossier(tripId, actor, detail);
  packs.set(tripId, { ...loaded, expiresAt: Date.now() + PACK_TTL_MS });
  return loaded;
}

/**
 * Before a city is saved, a general question can still look the place up.
 * After a city is saved, only a place question opens Atlas again.
 */
export function questionNeedsPlaceLookup(placeNames: string[]): boolean {
  return placeNames.length === 0;
}

function known(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function line(label: string, value: string | null | undefined): string {
  return `${label}: ${known(value) ?? "not on file"}`;
}

function documentLine(document: ClientDocument): string {
  const bits = [
    document.document_type,
    document.document_number,
    document.issuing_country,
    document.expiry_date ? `expires ${document.expiry_date}` : null,
    document.date_of_birth ? `born ${document.date_of_birth}` : null,
    document.status,
  ].filter(Boolean);
  return bits.join(", ");
}

function preferenceLine(row: ClientPreference): string {
  const confirmed = row.is_confirmed ? "" : " (unconfirmed)";
  const notes = known(row.notes);
  return `${row.sentiment} ${row.label}${row.category ? ` (${row.category})` : ""}${confirmed}${notes ? ` — ${notes}` : ""}`;
}

function healthLines(health: ClientHealthProfile | null): string[] {
  if (!health) {
    return ["Health: not on file"];
  }
  const diet = health.dietary_restrictions?.filter((item) => item.trim()) ?? [];
  return [
    `Diet: ${diet.length > 0 ? diet.join(", ") : "not on file"}`,
    line("Mobility", health.mobility_notes),
    line("Medication", health.medication_notes),
    line("Health notes", health.notes),
    line("Emergency contact", health.emergency_contact_name),
    line("Emergency phone", health.emergency_contact_phone),
    `Share health with hotels: ${health.share_with_hotels ? "yes" : "no"}`,
  ];
}

async function clientSection(
  clientId: string,
  role: string,
): Promise<string> {
  const [client, preferences, health, documents] = await Promise.all([
    findClientById(clientId),
    listClientPreferences(clientId, { limit: 50 }),
    findClientHealth(clientId),
    listClientDocuments(clientId, { limit: 20 }),
  ]);
  if (!client) return `${role}: not on file`;
  const tier = await findClientTierById(client.tier_id);
  const dates = Array.isArray(client.important_dates) ? client.important_dates : [];
  const dateLines =
    dates.length > 0
      ? dates
          .filter((row) => known(row.label) && known(row.date))
          .map((row) => `${row.label}: ${row.date}`)
      : ["not on file"];
  const address = [
    client.address_line_1,
    client.address_line_2,
    client.address_city,
    client.address_state,
    client.address_postal_code,
    client.address_country,
  ]
    .map((part) => known(part))
    .filter(Boolean)
    .join(", ");

  return [
    `${role}: ${client.display_name}`,
    line("Title", client.title),
    line("Legal name", client.legal_name),
    line("Email", client.email),
    line("Phone", client.phone),
    line("WhatsApp", client.whatsapp),
    line("Preferred contact", client.preferred_contact_method),
    line("Language", client.preferred_language),
    line("Nationality", client.nationality),
    line("Home city", client.city_of_residence),
    line("Company", client.company),
    line("Address", address || null),
    line("Tier", tier?.label),
    line("Client since", client.client_since),
    line("Guest notes", client.guest_notes),
    line("Internal notes", client.internal_notes),
    "Important dates:",
    ...dateLines.map((row) => `- ${row}`),
    "Preferences:",
    ...(preferences.length > 0
      ? preferences.map((row) => `- ${preferenceLine(row)}`)
      : ["- not on file"]),
    ...healthLines(health),
    "Documents:",
    ...(documents.length > 0
      ? documents.map((document) => `- ${documentLine(document)}`)
      : ["- not on file"]),
  ].join("\n");
}

function peopleOf(detail: TripDetail): Array<{ clientId: string; role: string }> {
  if (detail.travellers.length > 0) {
    return detail.travellers.map((person) => ({
      clientId: person.client_id,
      role: person.role === "primary" ? "Lead" : person.party_role === "child" ? "Child" : "Traveller",
    }));
  }
  if (detail.client) {
    return [{ clientId: detail.client.id, role: "Lead" }];
  }
  return [];
}

async function staySection(detail: TripDetail, stay: TripStaySnapshot): Promise<string> {
  const selected =
    detail.rates.candidates.find((rate) => rate.selected && rate.leg_id === stay.leg_id) ?? null;
  const facts = stay.property_id
    ? await loadHotelStayFacts({
        propertyId: stay.property_id,
        checkIn: stay.check_in,
        checkOut: stay.check_out,
        contractId: null,
      })
    : null;
  const booking = await findOpenHotelBookingForTrip(detail.trip.id, stay.leg_id);
  const property = facts?.property;
  return [
    `Stay: ${stay.city}`,
    line("Hotel", stay.property_name),
    line("Check-in", stay.check_in),
    line("Check-out", stay.check_out),
    line("Adults", stay.adults == null ? null : String(stay.adults)),
    line("Children", stay.children == null ? null : String(stay.children)),
    line("Rooms", stay.rooms == null ? null : String(stay.rooms)),
    line("Property phone", property?.general_phone),
    line("Reservations email", property?.reservations_email),
    line("Booking notes", property?.booking_notes),
    line("VIP notes", property?.vip_contact_notes),
    line("Check-in time", facts?.checkInTime),
    line("Check-out time", facts?.checkOutTime),
    "Cancellation:",
    ...(facts && facts.cancellationLines.length > 0
      ? facts.cancellationLines.map((row) => `- ${row}`)
      : ["- not on file"]),
    "Payment:",
    ...(facts && facts.paymentLines.length > 0
      ? facts.paymentLines.map((row) => `- ${row}`)
      : ["- not on file"]),
    facts?.recordNotes?.trim()
      ? `Contract and hotel record:\n${facts.recordNotes.trim()}`
      : "Contract and hotel record: not on file",
    selected
      ? `Selected rate: ${selected.title}${selected.subtitle ? ` (${selected.subtitle})` : ""} — ${selected.currency ?? ""} ${selected.cost_internal ?? "cost not on file"}`.trim()
      : "Selected rate: not on file",
    selected?.cancellation_policy?.trim()
      ? `Selected rate cancellation: ${selected.cancellation_policy.trim()}`
      : "Selected rate cancellation: not on file",
    booking
      ? `Booking: ${booking.status}, confirmation ${booking.supplier_ref?.trim() || "not on file"}`
      : "Booking: not on file",
  ].join("\n");
}

async function placeSection(stays: TripStaySnapshot[]): Promise<{ text: string; names: string[] }> {
  const names = new Set<string>();
  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const stay of stays) {
    const city = stay.city.trim();
    const hotel = stay.property_name?.trim() || "";
    if (city) names.add(city);
    if (hotel) names.add(hotel);
    const key = `${city.toLowerCase()}|${hotel.toLowerCase()}`;
    if (!city && !hotel) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const atlas = await answerAtlasStay({
      question: `${hotel} ${city} visa season currency safety hotels rooms amenities dining spa wellness`.trim(),
      cityHint: city || null,
    });
    blocks.push(atlas.answer.trim() || `Place notes for ${hotel || city}: not on file`);
  }
  return {
    text: blocks.length > 0 ? blocks.join("\n\n") : "Place notes: not on file",
    names: [...names],
  };
}

function rateSection(detail: TripDetail): string {
  if (detail.rates.candidates.length === 0) return "Rates: not on file";
  return [
    "Rates:",
    ...detail.rates.candidates.map((rate) => {
      const cost =
        rate.cost_internal == null
          ? "cost not on file"
          : `${rate.currency ?? ""} ${rate.cost_internal}`.trim();
      const cancel = rate.cancellation_policy?.trim() || "cancellation not on file";
      return `- ${rate.selected ? "Selected" : "Option"}: ${rate.title} — ${cost}. ${cancel}`;
    }),
  ].join("\n");
}

function quoteSection(detail: TripDetail): string {
  const quote = detail.quote;
  const sell =
    quote.sell_total == null
      ? "not on file"
      : `${quote.sell_currency ?? ""} ${quote.sell_total}`.trim();
  return [
    "Quote:",
    line("Title", quote.title),
    line("Intro", quote.intro),
    line("Notes", quote.notes),
    `Highlights: ${quote.highlights.length > 0 ? quote.highlights.join(" | ") : "not on file"}`,
    `Sell price: ${sell}`,
    `PDF: ${quote.document?.status ?? "not on file"}`,
  ].join("\n");
}

async function loadTripDossier(
  tripId: string,
  actor: { memberId: string },
  detail?: TripDetail,
): Promise<{ notes: string; placeNames: string[] }> {
  const loaded = detail ?? (await getTripDetail(tripId, actor));
  const stays = loaded.stays.length > 0 ? loaded.stays : loaded.stay ? [loaded.stay] : [];
  const [clients, stayTexts, places] = await Promise.all([
    Promise.all(peopleOf(loaded).map((person) => clientSection(person.clientId, person.role))),
    Promise.all(stays.map((stay) => staySection(loaded, stay))),
    placeSection(stays),
  ]);

  const notes = [
    `Trip: ${loaded.trip.title?.trim() || "not on file"}`,
    line("Status", loaded.trip.status),
    line("Trip start", loaded.trip.starts_on),
    line("Trip end", loaded.trip.ends_on),
    `Pricing locked: ${loaded.pricing_locked ? "yes" : "no"}`,
    clients.length > 0 ? clients.join("\n\n") : "Client: not on file",
    stayTexts.length > 0 ? stayTexts.join("\n\n") : "Stays: not on file",
    places.text,
    rateSection(loaded),
    quoteSection(loaded),
  ].join("\n\n");

  return { notes, placeNames: places.names };
}
