import {
  findActivePropertyById,
  listActiveContractOffersForStay,
  listActivePropertyContractsForProperty,
  listActiveRateAddonsForStay,
  type Property,
  type PropertyContract,
  type PropertyContractBenefit,
  type PropertyContractOffer,
  type PropertyContractPolicies,
  type PropertyContractPayout,
  type PropertyRateAddon,
} from "@pureluxe/db";
import {
  readContractPolicies,
  type PolicyRuleV2,
} from "@pureluxe/rates";

export type HotelStayFacts = {
  property: Property | null;
  /** Contract on the selected rate, or the only contract that covers the stay. */
  contract: PropertyContract | null;
  /** Active contracts on file for the hotel, any dates. */
  contractCount: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** Advisor chat. Omits bank account numbers. */
  chatBrief: string | null;
  /** Studio-only booking note, including payout when the contract has it. */
  recordNotes: string | null;
  /** Prepay rules only. Cancel rules are cancellationLines. */
  paymentLines: string[];
  /** Cancel rules already stored on the contract. Empty when none are on file. */
  cancellationLines: string[];
  /** Offers that cover these dates. Empty when none are on file. */
  offers: string[];
  /** Charges the contract says must be added. Empty when none are on file. */
  requiredCharges: string[];
  /** Minimum markup already stored. Null when none is on file. */
  markup: string | null;
};

const UNIT_LABEL: Record<string, string> = {
  per_person_per_night: "per person per night",
  per_person: "per person",
  per_night: "per night",
  per_stay: "per stay",
  per_villa_per_night: "per villa per night",
  per_event: "per event",
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clockTime(value: string | null): string | null {
  if (!value) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)/.exec(value.trim());
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function previousDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function coversStay(
  validFrom: string | null,
  validTo: string | null,
  checkIn: string,
  checkOut: string,
): boolean {
  const lastNight = previousDay(checkOut);
  const fromOk = validFrom == null || validFrom <= checkIn;
  const toOk = validTo == null || validTo >= lastNight;
  return fromOk && toOk;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function ensureSentence(value: string): string {
  const text = value.trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** Advisor-facing lines from a policy section (client + team). */
function advisorRuleLines(rules: PolicyRuleV2[] | undefined): string[] {
  if (!rules?.length) return [];
  const lines: string[] = [];
  for (const rule of rules) {
    const season = rule.season?.trim() ?? "";
    const cancel = rule.cancel_days;
    const charge = rule.charge_pct;
    if (cancel != null || charge != null) {
      const detail =
        cancel != null && charge != null
          ? `cancel within ${cancel} days and the charge is ${charge}%`
          : cancel != null
            ? `cancel within ${cancel} days`
            : `cancellation charge is ${charge}%`;
      lines.push(
        ensureSentence(
          season
            ? `${season.charAt(0).toUpperCase()}${season.slice(1)}: ${detail}`
            : `${detail.charAt(0).toUpperCase()}${detail.slice(1)}`,
        ),
      );
      continue;
    }
    const text = rule.text.trim();
    if (text) lines.push(ensureSentence(text));
  }
  return lines;
}

/** Prepay-style payment lines for HotelStayFacts.paymentLines (advisor). */
function advisorPaymentLines(rules: PolicyRuleV2[] | undefined): string[] {
  if (!rules?.length) return [];
  return rules
    .map((rule) => rule.text.trim())
    .filter((text) => text.length > 0 && !/\bcancel/i.test(text))
    .map(ensureSentence);
}

function timesFromPolicies(policies: PropertyContractPolicies): {
  checkIn: string | null;
  checkOut: string | null;
} {
  const parsed = readContractPolicies(policies);
  let checkIn = clockTime(textValue(policies.check_in_time));
  let checkOut = clockTime(textValue(policies.check_out_time));
  for (const rule of parsed.stay ?? []) {
    checkIn = checkIn ?? clockTime(rule.check_in_time ?? null);
    checkOut = checkOut ?? clockTime(rule.check_out_time ?? null);
    const match =
      /check-?in\s+([0-2]?\d:[0-5]\d)[^\d]{0,40}check-?out\s+([0-2]?\d:[0-5]\d)/i.exec(
        rule.text,
      );
    if (!match) continue;
    checkIn = checkIn ?? clockTime(match[1] ?? null);
    checkOut = checkOut ?? clockTime(match[2] ?? null);
  }
  return { checkIn, checkOut };
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

function ageLabel(from: number | null, to: number | null): string | null {
  if (from != null && to != null) return `ages ${from}–${to}`;
  if (from != null) return `age ${from}+`;
  if (to != null) return `up to age ${to}`;
  return null;
}

function paymentLine(rule: unknown): string | null {
  if (typeof rule === "string" && rule.trim()) {
    if (/\bcancel/i.test(rule)) return null;
    return rule.trim();
  }
  if (!rule || typeof rule !== "object") return null;
  const row = rule as Record<string, unknown>;
  const season = textValue(row.season);
  const prepay = typeof row.prepay_days === "number" ? row.prepay_days : null;
  if (prepay == null) return null;
  const body = `pay ${prepay} days before arrival`;
  if (!season) return `${body}.`;
  const label = season.charAt(0).toUpperCase() + season.slice(1);
  return `${label}: ${body}.`;
}

function legalLines(legal: Record<string, unknown> | unknown[] | undefined): string[] {
  if (!legal || Array.isArray(legal)) return [];
  const lines: string[] = [];
  if (legal.direct_book_only === true) lines.push("Book direct only.");
  if (legal.confidential === true) lines.push("Rates are confidential.");
  if (legal.no_ota_bedbank_resell === true) {
    lines.push("Do not resell through an OTA or bedbank.");
  }
  if (typeof legal.min_markup_percent === "number") {
    lines.push(`Commission rate ${legal.min_markup_percent}%.`);
  }
  return lines;
}

function benefitLine(benefit: PropertyContractBenefit): string | null {
  const type = textValue(benefit.type)?.replaceAll("_", " ");
  const items = Array.isArray(benefit.items)
    ? benefit.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (!type && items.length === 0) return null;
  const needs: string[] = [];
  if (typeof benefit.min_nights === "number") {
    needs.push(`${benefit.min_nights} nights or more`);
  }
  const requires = textValue(benefit.requires)?.replaceAll("_", " ");
  if (requires) needs.push(requires);
  const head = type ? type.charAt(0).toUpperCase() + type.slice(1) : "Benefit";
  const when = needs.length > 0 ? ` (${needs.join("; ")})` : "";
  const list = items.length > 0 ? `: ${items.join(", ")}` : "";
  return `${head}${when}${list}.`;
}

function addonLine(addon: PropertyRateAddon): string {
  const unit = UNIT_LABEL[addon.unit] ?? addon.unit.replaceAll("_", " ");
  const age = ageLabel(addon.age_from, addon.age_to);
  const note = addon.notes?.trim();
  const bits = [
    addon.mandatory ? "Required" : "Optional",
    `${addon.name} — ${money(Number(addon.amount), addon.currency)} ${unit}`,
    age,
    note,
  ].filter(Boolean);
  return bits.join(". ") + ".";
}

function offerLine(offer: PropertyContractOffer): string {
  const bits = [offer.name];
  if (offer.percent_off_villa != null) {
    bits.push(`${offer.percent_off_villa}% off the villa`);
  }
  if (offer.free_board) bits.push(`free ${offer.free_board}`);
  if (offer.transfer_discount_percent != null) {
    bits.push(`${offer.transfer_discount_percent}% off the transfer`);
  }
  if (offer.min_nights != null) bits.push(`minimum ${offer.min_nights} nights`);
  if (offer.book_by) bits.push(`book by ${offer.book_by}`);
  const blackouts = stringList(offer.blackout_dates);
  if (blackouts.length > 0) bits.push(`not valid on ${blackouts.join(", ")}`);
  if (offer.notes?.trim()) bits.push(offer.notes.trim());
  return bits.join(". ") + ".";
}

function payoutLines(payout: PropertyContractPayout): string[] {
  const pairs: Array<[string, string | undefined]> = [
    ["Account name", payout.account_name],
    ["Bank", payout.bank_name],
    ["Account", payout.account_number],
    ["SWIFT", payout.swift],
    ["Currency", payout.currency],
    ["Correspondent bank", payout.correspondent_bank],
    ["Correspondent SWIFT", payout.correspondent_swift],
  ];
  return pairs
    .filter((pair): pair is [string, string] => Boolean(pair[1]?.trim()))
    .map(([label, value]) => `${label}: ${value.trim()}`);
}

function section(title: string, lines: string[]): string | null {
  const body = lines.map((line) => line.trim()).filter(Boolean);
  if (body.length === 0) return null;
  return `**${title}**\n${body.map((line) => `- ${line}`).join("\n")}`;
}

function contractSections(
  contract: PropertyContract,
  addons: PropertyRateAddon[],
  offers: PropertyContractOffer[],
  includePayout: boolean,
): {
  chat: string[];
  record: string[];
  payment: string[];
  cancellation: string[];
  offers: string[];
  required: string[];
} {
  const policies = contract.policies ?? {};
  // v2 + legacy: stay / payment / cancel / transfer / legal via readContractPolicies.
  const parsed = readContractPolicies(policies);
  const stayRules = advisorRuleLines(parsed.stay).filter(
    (rule) => !/check-?in\s+[0-2]?\d:[0-5]\d/i.test(rule),
  );
  const payment = advisorPaymentLines(parsed.payment);
  // Legacy structured prepay objects (prepay_days) when no text payment lines.
  if (payment.length === 0 && Array.isArray(policies.payment_rules)) {
    for (const rule of policies.payment_rules) {
      const line = paymentLine(rule);
      if (line) payment.push(line);
    }
  }
  const cancellation = advisorRuleLines(parsed.cancellation);
  const transfers = advisorRuleLines(parsed.transfer);
  // Legacy boolean legal flags (Kanuhura) + v2/legacy legal text rules.
  const legal = [
    ...legalLines(
      policies.legal && !Array.isArray(policies.legal)
        ? (policies.legal as Record<string, unknown>)
        : undefined,
    ),
    ...advisorRuleLines(parsed.legal),
  ];
  const benefits = (Array.isArray(contract.benefits) ? contract.benefits : [])
    .map(benefitLine)
    .filter((line): line is string => Boolean(line));
  const contractAddons = addons.filter((row) => row.contract_id === contract.id);
  const contractOffers = offers.filter((row) => row.contract_id === contract.id);
  const offerLines = contractOffers.map(offerLine);
  const required = contractAddons.filter((row) => row.mandatory).map(addonLine);
  const optional = contractAddons.filter((row) => !row.mandatory).map(addonLine);
  const header = [
    contract.market ? `Market: ${contract.market}.` : null,
    contract.booking_code ? `Quote booking code ${contract.booking_code}.` : null,
    contract.min_markup_percent != null
      ? `Commission rate ${contract.min_markup_percent}%.`
      : null,
    contract.notes?.trim() || null,
  ].filter((line): line is string => Boolean(line));

  const blocks = [
    section(contract.name, header),
    section("Stay rules", stayRules),
    section("Cancellation", cancellation),
    section("Payment", payment),
    section("Transfers", transfers),
    section("Contract terms", legal),
    section("Benefits", benefits),
    section("Charges that must be added", required),
    section("Optional extras", optional),
    section("Offers that cover these dates", offerLines),
  ].filter((block): block is string => Boolean(block));

  const payout = includePayout ? payoutLines(contract.payout ?? {}) : [];
  const record = [
    ...blocks,
    payout.length > 0 ? section("Supplier payout", payout) : null,
  ].filter((block): block is string => Boolean(block));

  return { chat: blocks, record, payment, cancellation, offers: offerLines, required };
}

function propertyLines(property: Property | null): string[] {
  if (!property) return [];
  return [
    property.booking_notes?.trim() || null,
    property.reservations_email?.trim()
      ? `Reservations: ${property.reservations_email.trim()}`
      : null,
    property.general_phone?.trim() ? `Phone: ${property.general_phone.trim()}` : null,
    property.vip_contact_notes?.trim()
      ? `VIP contact: ${property.vip_contact_notes.trim()}`
      : null,
    property.min_markup_percent != null
      ? `Hotel minimum markup ${property.min_markup_percent}%.`
      : null,
  ].filter((line): line is string => Boolean(line));
}

/**
 * Plain-language facts already stored for this hotel and these dates.
 * Nothing here is invented.
 */
export async function loadHotelStayFacts(input: {
  propertyId: string;
  checkIn: string | null;
  checkOut: string | null;
  contractId: string | null;
}): Promise<HotelStayFacts | null> {
  const property = await findActivePropertyById(input.propertyId);
  const allContracts = await listActivePropertyContractsForProperty(input.propertyId);
  const dated =
    input.checkIn && input.checkOut
      ? allContracts.filter((row) =>
          coversStay(row.valid_from, row.valid_to, input.checkIn!, input.checkOut!),
        )
      : allContracts;
  const selected =
    (input.contractId
      ? allContracts.find((row) => row.id === input.contractId) ?? null
      : null) ?? (dated.length === 1 ? dated[0] : null);
  const contracts = selected
    ? [selected, ...dated.filter((row) => row.id !== selected.id)]
    : dated;

  let checkInTime: string | null = null;
  let checkOutTime: string | null = null;
  const timeSources = [
    ...contracts,
    ...allContracts.filter((row) => !contracts.some((kept) => kept.id === row.id)),
  ];
  for (const contract of timeSources) {
    const times = timesFromPolicies(contract.policies ?? {});
    checkInTime = checkInTime ?? times.checkIn;
    checkOutTime = checkOutTime ?? times.checkOut;
  }

  const addons =
    input.checkIn && input.checkOut
      ? await listActiveRateAddonsForStay({
          property_id: input.propertyId,
          check_in: input.checkIn,
          check_out: input.checkOut,
        })
      : [];
  const offers =
    input.checkIn && input.checkOut
      ? await listActiveContractOffersForStay({
          property_id: input.propertyId,
          check_in: input.checkIn,
          check_out: input.checkOut,
        })
      : [];

  const chatBlocks: string[] = [];
  const recordBlocks: string[] = [];
  const paymentLines: string[] = [];
  const cancellationLines: string[] = [];
  const offerLines: string[] = [];
  const requiredCharges: string[] = [];
  const hotel = section("Hotel", propertyLines(property));
  if (hotel) {
    chatBlocks.push(hotel);
    recordBlocks.push(hotel);
  }
  for (const contract of contracts) {
    const parts = contractSections(contract, addons, offers, true);
    chatBlocks.push(...parts.chat);
    recordBlocks.push(...parts.record);
    if (selected == null || contract.id === selected.id) {
      paymentLines.push(...parts.payment);
      cancellationLines.push(...parts.cancellation);
      offerLines.push(...parts.offers);
      requiredCharges.push(...parts.required);
    }
  }
  for (const contract of allContracts) {
    if (contracts.some((row) => row.id === contract.id)) continue;
    const payout = payoutLines(contract.payout ?? {});
    const block = section(`${contract.name} payout`, payout);
    if (block) recordBlocks.push(block);
  }

  const intro =
    checkInTime || checkOutTime
      ? `Check-in ${checkInTime ?? "time not available"}, check-out ${checkOutTime ?? "time not available"}.`
      : null;

  const markupPercent = selected?.min_markup_percent ?? property?.min_markup_percent ?? null;
  return {
    property,
    contract: selected ?? null,
    contractCount: allContracts.length,
    checkInTime,
    checkOutTime,
    chatBrief: [intro, ...chatBlocks].filter(Boolean).join("\n\n") || null,
    recordNotes: recordBlocks.join("\n\n") || null,
    paymentLines,
    cancellationLines,
    offers: offerLines,
    requiredCharges,
    markup: markupPercent == null ? null : `Commission rate ${markupPercent}%.`,
  };
}

/** Wording that belongs on the studio file, not on a quote the client reads. */
const TEAM_WORDING =
  /\b(?:markup|confidential|advisor|ota|bedbank|payout|commission|booking code|stop sale|wholesale|swift|market only|new bookings?|combinable|contracted|tactical|separate quote|partner|issued|net|rate-based|villa rate|listed categories|villa groups?|groups?\s*=|[123]br)\b|@/i;
const SEASON_START = /^(peak|high|low|shoulder|other)\b/i;

function clientSentence(value: string): string | null {
  const text = value.replace(/^required\.\s*/i, "").trim();
  if (!text || TEAM_WORDING.test(text)) return null;
  const sentence = /[.!?]$/.test(text) ? text : `${text}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** Keep guest clauses. Drop a sentence that is only for the team. */
function clientClauses(value: string): string | null {
  const kept = value
    .split(/(?<=\.)\s+/)
    .map((part) => clientSentence(part))
    .filter((part): part is string => Boolean(part));
  if (kept.length === 0) return null;
  return kept.join(" ");
}

function datesMissStay(line: string, checkIn: string, checkOut: string): boolean {
  const dates = [...line.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((match) => match[0] ?? "");
  if (dates.length === 0) return false;
  return dates.every((date) => date < checkIn || date >= checkOut);
}

function forStaySeason(line: string, seasons: string[]): boolean {
  const labelled = SEASON_START.exec(line);
  if (!labelled) return true;
  const name = labelled[1]?.toLowerCase();
  return seasons.some((season) => season.toLowerCase() === name);
}

/** Client-facing rules for one room's contract and season. Team notes stay off. */
export type ClientQuoteFacts = {
  arrival: string[];
  transfers: string[];
  stay: string[];
  benefits: string[];
  charges: string[];
};

/**
 * Policies and benefits a client can read for this room and these dates.
 * Advisor markup, bank payout, and other seasons stay off the list.
 */
export async function clientQuotePolicies(input: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  contractId: string | null;
  seasons: string[];
}): Promise<ClientQuoteFacts> {
  const empty: ClientQuoteFacts = { arrival: [], transfers: [], stay: [], benefits: [], charges: [] };
  const facts = await loadHotelStayFacts({
    propertyId: input.propertyId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    contractId: input.contractId,
  });
  const contract = facts?.contract;
  if (!facts || !contract) return empty;
  const policies = contract.policies ?? {};
  const arrival: string[] = [];
  const transfers: string[] = [];
  const stay: string[] = [];
  const benefits: string[] = [];
  const charges: string[] = [];
  if (facts.checkInTime || facts.checkOutTime) {
    const clocks = [
      facts.checkInTime ? `Check-in ${facts.checkInTime}` : null,
      facts.checkOutTime ? `check-out ${facts.checkOutTime}` : null,
    ].filter((part): part is string => Boolean(part));
    const clock = clientSentence(clocks.join(", "));
    if (clock) arrival.push(clock);
  }
  const keepSeasonLine = (rule: string, target: string[]) => {
    if (datesMissStay(rule, input.checkIn, input.checkOut)) return;
    const line = clientClauses(rule);
    if (line && forStaySeason(line, input.seasons)) target.push(line);
  };
  // Client PDF: only audience=client rules (v2) / legacy mapped as client.
  const parsed = readContractPolicies(policies);
  for (const rule of parsed.stay ?? []) {
    if (rule.audience === "team") continue;
    if (/check-?in\s+[0-2]?\d:[0-5]\d/i.test(rule.text)) continue;
    keepSeasonLine(rule.text, stay);
  }
  for (const rule of parsed.transfer ?? []) {
    if (rule.audience === "team") continue;
    keepSeasonLine(rule.text, transfers);
  }
  for (const benefit of contract.benefits ?? []) {
    const line = benefitLine(benefit);
    const guest = line ? clientClauses(line) : null;
    if (guest && forStaySeason(guest, input.seasons)) benefits.push(guest);
  }
  for (const charge of facts.requiredCharges) {
    if (datesMissStay(charge, input.checkIn, input.checkOut)) continue;
    const line = clientClauses(charge);
    if (line) charges.push(line);
  }
  return {
    arrival: [...new Set(arrival)],
    transfers: [...new Set(transfers)],
    stay: [...new Set(stay)],
    benefits: [...new Set(benefits)],
    charges: [...new Set(charges)],
  };
}
