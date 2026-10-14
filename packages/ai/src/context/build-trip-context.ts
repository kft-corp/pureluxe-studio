import {
  TRIP_BUILDER_STAGE_LABELS,
  type TripFacts,
  type TripRateFact,
} from "../types";

import {
  listTripGaps,
  resolveNextStep,
  resolveTripStage,
} from "./trip-stage";

const MAX_CANDIDATES = 8;
const MAX_TEXT = 400;
/** Cancellation, payment, and inclusions for the rooms listed in this prompt. */
const MAX_ROOM_FACT = 1200;

function money(
  amount: number | null,
  currency: string | null,
): string {
  if (amount == null) return "missing";
  const code = currency?.trim() || "";
  return code ? `${code} ${amount}` : String(amount);
}

function textOrMissing(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? clip(trimmed) : "missing";
}

function clip(value: string, max = MAX_TEXT): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function roomFact(label: string, value: string | null | undefined, empty: string): string {
  const text = value?.trim();
  if (!text) return empty;
  return `${label} ${clip(text, MAX_ROOM_FACT)}`;
}

function nightsBetween(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number | null {
  if (!checkIn || !checkOut) return null;
  const from = Date.parse(`${checkIn}T12:00:00Z`);
  const to = Date.parse(`${checkOut}T12:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function formatRate(rate: TripRateFact): string {
  const bits = [
    rate.title,
    rate.subtitle ? `(${rate.subtitle})` : null,
    `team cost ${money(rate.cost_internal, rate.currency)}`,
    rate.sell_amount != null
      ? `client price ${money(rate.sell_amount, rate.currency)}`
      : "client price not set",
    roomFact("included", rate.inclusions?.join(", "), "included not in PureLuxe"),
    roomFact("cancellation", rate.cancellation_policy, "cancellation not in PureLuxe"),
    roomFact("payment", rate.payment_policy, "payment not in PureLuxe"),
    rate.selected ? "selected" : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/**
 * Compact trip snapshot for the model system prompt.
 * Facts only — no instructions (those live in prompts/).
 */
export function buildTripContext(trip: TripFacts): string {
  const stage = resolveTripStage(trip);
  const selected = trip.rates.selected;
  const gaps = listTripGaps(trip);
  const nights = nightsBetween(trip.stay?.check_in, trip.stay?.check_out);
  const candidates = trip.rates.candidates.slice(0, MAX_CANDIDATES);
  const omitted =
    trip.rates.candidates.length > candidates.length
      ? trip.rates.candidates.length - candidates.length
      : 0;

  const lines = [
    `Title: ${textOrMissing(trip.title)}`,
    `Status: ${trip.status || "missing"}`,
    `Pricing locked: ${trip.pricing_locked ? "yes (stay/rate edits may be blocked)" : "no"}`,
    `Stage: ${TRIP_BUILDER_STAGE_LABELS[stage]}`,
    `Next step: ${resolveNextStep(trip)}`,
    `Gaps: ${gaps.length ? gaps.join("; ") : "none"}`,
    "",
    `Trip dates: ${
      trip.starts_on && trip.ends_on
        ? `${trip.starts_on} to ${trip.ends_on}`
        : "missing"
    }`,
    `Stay list finished: ${trip.legs_confirmed ? "yes" : "no"}`,
    "",
    "Client:",
    trip.client
      ? `- Lead: ${trip.client.display_name} (client_id ${trip.client.id})`
      : "- Lead: missing",
    `Travellers confirmed: ${trip.travellers_confirmed ? "yes" : "no"}`,
    ...(trip.travellers ?? []).map(
      (person) =>
        `- ${person.display_name} (${person.role === "primary" ? "lead" : person.party_role})`,
    ),
    ...(trip.family_suggestions?.length
      ? [
          "Household not on the trip yet:",
          ...trip.family_suggestions.map(
            (person) => `- ${person.display_name} (${person.family_role})`,
          ),
        ]
      : []),
    "",
    "Stay:",
  ];

  const stays = trip.stays ?? [];
  if (stays.length === 0 && !trip.stay) {
    lines.push("- missing");
  } else if (stays.length === 0 && trip.stay) {
    lines.push(
      `- Hotel: ${textOrMissing(trip.stay.property_name)}`,
      `- City: ${textOrMissing(trip.stay.city)}`,
      `- Check-in: ${textOrMissing(trip.stay.check_in)}`,
      `- Check-out: ${textOrMissing(trip.stay.check_out)}`,
      `- Nights: ${nights != null ? String(nights) : "missing"}`,
    );
  } else {
    stays.forEach((stay, index) => {
      const nightsForStay = nightsBetween(stay.check_in, stay.check_out);
      lines.push(
        `- Stay ${index + 1}: ${textOrMissing(stay.city)}`,
        `  Hotel: ${textOrMissing(stay.property_name)}`,
        `  Check-in: ${textOrMissing(stay.check_in)}`,
        `  Check-out: ${textOrMissing(stay.check_out)}`,
        `  Nights: ${nightsForStay != null ? String(nightsForStay) : "missing"}`,
        `  Rate selected: ${stay.rate_selected ? "yes" : "no"}`,
      );
    });
  }

  lines.push("", "Rates:");
  if (selected) {
    lines.push(`- Selected: ${formatRate(selected)}`);
  } else {
    lines.push("- Selected: missing");
  }

  if (candidates.length === 0) {
    lines.push("- Saved candidates: none");
  } else {
    lines.push(`- Saved candidates (${trip.rates.candidates.length}):`);
    for (const rate of candidates) {
      lines.push(`  - ${formatRate(rate)}`);
    }
    if (omitted > 0) {
      lines.push(`  - ${omitted} more rooms are not listed here`);
    }
  }

  lines.push(
    "",
    "Quote draft (client-facing):",
    `- Title: ${textOrMissing(trip.quote.title)}`,
    `- Intro: ${textOrMissing(trip.quote.intro)}`,
    `- Notes: ${textOrMissing(trip.quote.notes)}`,
    `- Highlights: ${
      trip.quote.highlights.length
        ? trip.quote.highlights.map(clip).join(" | ")
        : "none"
    }`,
    `- Sell price (client): ${money(trip.quote.sell_total, trip.quote.sell_currency)}`,
    `- Document status: ${trip.quote.document_status ?? "none"}`,
    `- PDF file ready: ${trip.quote.has_file ? "yes" : "no"}`,
  );

  if (trip.price) {
    lines.push(
      "",
      "Price (advisor only, already calculated):",
      `- Hotel net: ${trip.price.hotel_net ?? "missing"}`,
      `- Tax: ${trip.price.tax ?? "missing"}`,
      `- Margin: ${trip.price.margin ?? "missing"}${trip.price.margin_percent ? ` (${trip.price.margin_percent} of the client price)` : ""}`,
      `- Client price: ${trip.price.client_price ?? "missing"}`,
      ...(trip.price.note ? [`- Note: ${trip.price.note}`] : []),
    );
  }

  if (trip.readiness) {
    lines.push(
      "",
      "Before booking (already checked):",
      ...(trip.readiness.length > 0 ? trip.readiness.map((item) => `- ${item}`) : ["- nothing flagged"]),
    );
  }

  return lines.join("\n");
}
