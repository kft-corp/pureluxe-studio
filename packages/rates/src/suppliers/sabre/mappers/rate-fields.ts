import type { RawRateInput } from "../../../results";
import type { RateSourceCode } from "../../../types";
import { asArray, asNumber, asRecord, asString } from "../helpers";

/**
 * Stay total for cost_internal — never use AverageNightlyRate here.
 * Nightly stays in raw only.
 */
export function pickAmount(rate: Record<string, unknown>): {
  amount: number | null;
  currency: string | null;
  averageNightly: number | null;
} {
  const amount =
    asNumber(rate.AmountAfterTax) ??
    asNumber(rate.AmountBeforeTax) ??
    asNumber(rate.ApproxTotalPrice);
  return {
    amount,
    currency: asString(rate.CurrencyCode),
    averageNightly: asNumber(rate.AverageNightlyRate),
  };
}

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const rec = asRecord(value);
  if (!rec) return null;
  return (
    asString(rec.Text) ??
    asString(rec.Description) ??
    asString(rec.ShortText) ??
    asString(rec.value) ??
    asString(rec.Value)
  );
}

function textList(value: unknown): string[] {
  const out: string[] = [];
  for (const row of asArray(value)) {
    if (typeof row === "string" && row.trim()) {
      out.push(row.trim());
      continue;
    }
    const text = textFromUnknown(row);
    if (text) out.push(text);
  }
  return out;
}

/**
 * Short room label for the rate table — never Sabre policy paragraphs.
 * Prefer room type → bed → short plan/name. Long RoomDescription.Text is rate_terms.
 */
export function pickRoomName(rate: Record<string, unknown>): string | null {
  const roomType = asString(rate.RoomType);
  if (roomType) return roomType;

  const bed = asString(rate.BedType);
  if (bed) return bed;

  // Name only — Text is often the advance-purchase / cancel policy blurb.
  const fromDescName = asArray(rate.RoomRateDescription)
    .map((d) => asRecord(d))
    .filter((d): d is Record<string, unknown> => Boolean(d))
    .map((d) => asString(d.Name))
    .find(Boolean);
  if (fromDescName && !looksLikeRatePolicyBlurb(fromDescName)) return fromDescName;

  const planName =
    asString(rate.RatePlanName) ??
    asString(rate.ProductName) ??
    asString(asRecord(rate.RoomDescription)?.Name);
  if (planName && !looksLikeRatePolicyBlurb(planName)) return planName;

  return asString(rate.RoomTypeCode) ?? planName ?? null;
}

/** Policy / prepaid blurbs belong under the table, not as the room title. */
function looksLikeRatePolicyBlurb(text: string): boolean {
  const t = text.trim();
  if (t.length > 60) return true;
  return /\b(full payment|non[\s-]?refundable|no changes|no credit|paid in (full )?advance)\b/i.test(
    t,
  );
}

/** "No breakfast" / "breakfast not included" — never treat as included. */
function deniesBreakfast(text: string): boolean {
  return /\b(?:no|not|without|exclud(?:e|es|ed)|does\s+not\s+include)\b[\s\w/-]{0,28}\bbreakfast\b|\bbreakfast\b[\s\w/-]{0,20}\b(?:not\s+included|excluded|not\s+available)/i.test(
    text,
  );
}

/**
 * Strong positive cue that breakfast is included (industry-standard board upgrade).
 * Prefer meal codes / "breakfast included" — never a bare word in a long blurb.
 */
export function textIndicatesBreakfastIncluded(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  const raw = text.trim().replace(/\s+/g, " ");
  if (deniesBreakfast(raw)) return false;

  const compact = raw.replace(/\s+/g, "");
  if (/^(bb|bnb)$/i.test(compact)) return true;
  if (/^bed\s*(?:and|&)\s*breakfast$/i.test(raw)) return true;
  if (/^room\s+with\s+breakfast$/i.test(raw)) return true;
  if (/^breakfast$/i.test(raw)) return true;

  // Explicit include language (plan names like "Ap breakfast included").
  if (/\bbreakfast\s+included\b/i.test(raw)) return true;
  if (/\bincludes?\s+breakfast\b/i.test(raw)) return true;
  if (/\bwith\s+breakfast\b/i.test(raw)) return true;
  if (/\bap\b[\s\w-]{0,24}\bbreakfast\b/i.test(raw)) return true;

  // Short meal labels only (≤40 chars) — not marketing paragraphs.
  if (raw.length <= 40 && /\bbreakfast\b/i.test(raw)) return true;

  return false;
}

function rateMentionsBreakfast(rate: Record<string, unknown>): boolean {
  // 1) Trust Sabre meal / board fields first.
  for (const field of [
    asString(rate.MealPlanDescription),
    asString(rate.MealPlanCode),
    asString(rate.BoardCode),
    asString(rate.Board),
  ]) {
    if (textIndicatesBreakfastIncluded(field)) return true;
  }

  // 2) Rate plan name (common when MealPlan stays RO).
  if (textIndicatesBreakfastIncluded(asString(rate.RatePlanName))) return true;

  // 3) Inclusions — strong positive only.
  const inclusions = asRecord(rate.RatePlanInclusions);
  for (const row of asArray(
    inclusions?.RatePlanInclusion ?? rate.RatePlanInclusion ?? rate.Inclusions,
  )) {
    const line =
      asString(asRecord(row)?.Description) ??
      asString(asRecord(row)?.Name) ??
      textFromUnknown(row);
    if (textIndicatesBreakfastIncluded(line)) return true;
  }

  // 4) Description texts — only explicit include phrasing (never bare "breakfast").
  for (const text of textList(rate.RatePlanDescriptionTexts)) {
    if (deniesBreakfast(text)) continue;
    if (
      /\bbreakfast\s+included\b|\bincludes?\s+breakfast\b|\bwith\s+breakfast\b/i.test(
        text,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function pickBoard(rate: Record<string, unknown>): string | null {
  const board =
    asString(rate.MealPlanDescription) ??
    asString(rate.MealPlanCode) ??
    asString(rate.BoardCode) ??
    asString(rate.Board);
  const hasBreakfast = rateMentionsBreakfast(rate);
  const isRoomOnly =
    !board || /^(ro|room\s*only)$/i.test(board.trim().replace(/\s+/g, " "));

  // Breakfast often lives on the rate plan name while MealPlan stays RO.
  if (hasBreakfast && (isRoomOnly || textIndicatesBreakfastIncluded(board))) {
    return "Room with breakfast";
  }
  if (board) return board;
  // GDS room rates without a meal plan are typically room-only.
  if (asString(rate.RoomType) || asString(rate.RatePlanName)) {
    return "Room only";
  }
  return null;
}

function isFalsyFlag(value: unknown): boolean {
  return value === false || value === "false" || value === "False" || value === 0;
}

/** Sabre boolish fields (true/"true"/"1"/"Y") → boolean | null when absent. */
function asSabreBool(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "True" || value === "1") {
    return true;
  }
  if (typeof value === "string" && /^(y|yes)$/i.test(value.trim())) return true;
  if (isFalsyFlag(value)) return false;
  return null;
}

/** YYYY-MM-DD from Sabre AbsoluteDeadline (keeps calendar date, drops time/offset). */
export function formatSabreAbsoluteDeadline(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function formatCancelUntilLabel(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(ms)) return `Free cancel until ${isoDate}`;
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(ms);
  return `Free cancel until ${label}`;
}

/** Subtract whole days from YYYY-MM-DD (UTC noon) → YYYY-MM-DD. */
function subtractDaysFromIsoDate(
  isoDate: string,
  days: number,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isFinite(days) || days < 0) {
    return null;
  }
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Resolve Sabre Deadline AbsoluteDeadline, or offset BeforeArrival vs check-in.
 * Example: OffsetUnitMultiplier 1 + Day + BeforeArrival + check-in 2026-12-18 → 2026-12-17.
 */
function absoluteDeadlineFromPenalty(
  penalty: Record<string, unknown>,
  checkIn?: string | null,
): string | null {
  const deadline = asRecord(penalty.Deadline) ?? asRecord(penalty.Deadlines);
  const absolute =
    asString(deadline?.AbsoluteDeadline) ??
    asString(deadline?.absoluteDeadline) ??
    asString(penalty.AbsoluteDeadline);
  const fromAbsolute = formatSabreAbsoluteDeadline(absolute);
  if (fromAbsolute) return fromAbsolute;

  const checkInIso = checkIn?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInIso) || !deadline) return null;

  const drop =
    (asString(deadline.OffsetDropTime) ?? asString(deadline.offsetDropTime) ?? "")
      .trim()
      .toLowerCase();
  // Only convert arrival-relative offsets (booking-relative needs book time we don't have).
  if (drop && drop !== "beforearrival") return null;

  const unitRaw =
    asString(deadline.OffsetTimeUnit) ?? asString(deadline.offsetTimeUnit) ?? "";
  const unit = unitRaw.trim().toLowerCase();
  const multiplier =
    asNumber(deadline.OffsetUnitMultiplier) ??
    asNumber(deadline.offsetUnitMultiplier);
  if (multiplier == null || multiplier < 0) return null;

  let days: number | null = null;
  if (unit === "day" || unit === "days") {
    days = multiplier;
  } else if (unit === "week" || unit === "weeks") {
    days = multiplier * 7;
  } else if (unit === "hour" || unit === "hours") {
    days = Math.ceil(multiplier / 24);
  }
  if (days == null) return null;

  return subtractDaysFromIsoDate(checkInIso, days);
}

function penaltyNightsFromPenalty(
  penalty: Record<string, unknown>,
): number | null {
  const amountPercent =
    asRecord(penalty.AmountPercent) ?? asRecord(penalty.Amount);
  const nights =
    asNumber(amountPercent?.NmbrOfNights) ??
    asNumber(amountPercent?.NumberOfNights) ??
    asNumber(penalty.NmbrOfNights);
  if (nights == null || nights <= 0) return null;
  return Math.floor(nights);
}

/**
 * First cancel-by date on a rate (AbsoluteDeadline or offset BeforeArrival).
 * Pass checkIn so Day/Hour offsets resolve to YYYY-MM-DD.
 */
export function pickCancelDeadline(
  rate: Record<string, unknown>,
  checkIn?: string | null,
): string | null {
  const penaltiesBlock =
    asRecord(rate.CancelPenalties) ?? asRecord(rate.CancellationPenalties);
  const penaltyRows = asArray(
    penaltiesBlock?.CancelPenalty ??
      penaltiesBlock?.CancellationPenalty ??
      rate.CancelPenalty,
  );
  for (const row of penaltyRows) {
    const penalty = asRecord(row);
    if (!penalty) continue;
    if (isFalsyFlag(penalty.Refundable)) continue;
    const deadline = absoluteDeadlineFromPenalty(penalty, checkIn);
    if (deadline) return deadline;
  }
  for (const row of penaltyRows) {
    const penalty = asRecord(row);
    if (!penalty) continue;
    const deadline = absoluteDeadlineFromPenalty(penalty, checkIn);
    if (deadline) return deadline;
  }
  return null;
}

export function pickCancelPenaltyNights(
  rate: Record<string, unknown>,
): number | null {
  const penaltiesBlock =
    asRecord(rate.CancelPenalties) ?? asRecord(rate.CancellationPenalties);
  for (const row of asArray(
    penaltiesBlock?.CancelPenalty ??
      penaltiesBlock?.CancellationPenalty ??
      rate.CancelPenalty,
  )) {
    const penalty = asRecord(row);
    if (!penalty) continue;
    const nights = penaltyNightsFromPenalty(penalty);
    if (nights != null) return nights;
  }
  return null;
}

/**
 * Flatten Sabre CancelPenalties into advisor text.
 * Reads AbsoluteDeadline or BeforeArrival offset (+ checkIn) + NmbrOfNights.
 */
export function pickCancellation(
  rate: Record<string, unknown>,
  checkIn?: string | null,
): string | null {
  const direct =
    asString(rate.CancelPenaltyDescription) ??
    asString(rate.CancellationPolicy) ??
    asString(rate.CancelPenalty);
  if (direct) return direct;

  const descTexts = textList(rate.RoomDescriptionTexts);
  const advanceHint = descTexts.find((t) =>
    /non[\s-]?refundable|no changes|no credit/i.test(t),
  );

  const penaltiesBlock =
    asRecord(rate.CancelPenalties) ?? asRecord(rate.CancellationPenalties);
  const penaltyRows = asArray(
    penaltiesBlock?.CancelPenalty ??
      penaltiesBlock?.CancellationPenalty ??
      rate.CancelPenalty,
  );

  const parts: string[] = [];
  for (const row of penaltyRows) {
    const penalty = asRecord(row);
    if (!penalty) {
      const flat = textFromUnknown(row);
      if (flat) parts.push(flat);
      continue;
    }

    const deadline = absoluteDeadlineFromPenalty(penalty, checkIn);
    const nights = penaltyNightsFromPenalty(penalty);
    const description =
      asString(penalty.Description) ?? asString(penalty.PolicyCode);

    if (isFalsyFlag(penalty.Refundable)) {
      parts.push("Non-refundable");
      if (description && !/non[\s-]?refundable/i.test(description)) {
        parts.push(description);
      }
      continue;
    }

    if (penalty.Refundable === true || penalty.Refundable === "true") {
      if (deadline) {
        parts.push(formatCancelUntilLabel(deadline));
      } else {
        parts.push("Free cancel");
      }
      if (nights != null) {
        parts.push(
          nights === 1
            ? "then 1 night charge"
            : `then ${nights} nights charge`,
        );
      } else if (deadline) {
        parts.push("post-deadline fee not returned by GDS");
      }
      if (description && !/refundable|free cancel/i.test(description)) {
        parts.push(description);
      }
      continue;
    }

    // Refundable flag omitted — still use deadline / description when present.
    if (deadline) parts.push(formatCancelUntilLabel(deadline));
    if (nights != null) {
      parts.push(
        nights === 1
          ? "then 1 night charge"
          : `then ${nights} nights charge`,
      );
    }
    if (description) parts.push(description);
  }

  if (parts.length === 0 && advanceHint) {
    parts.push("Non-refundable");
  }

  if (parts.length > 0) {
    const unique = [...new Set(parts)];
    return unique.join("; ");
  }

  return asString(asRecord(rate.CancelPenalties)?.Description);
}

function formatMoney(amount: number, currency: string | null): string {
  const cur = currency?.trim() || "USD";
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${cur} ${rounded}`;
}

/** Advisor-facing payment timing (when Sabre/contract signals it). */
export type SabrePaymentTiming =
  | "prepaid"
  | "deposit"
  | "guarantee"
  | "pay_at_hotel";

/**
 * Strong payment-timing cue for Trip Builder chips.
 * Prefer deposit/guarantee codes, then prepaid, then pay-at-hotel — never invent.
 */
export function pickPaymentTiming(
  rate: Record<string, unknown>,
): SabrePaymentTiming | null {
  const guaranteeBlock =
    asRecord(rate.Guarantee) ??
    asRecord(rate.Guarantees) ??
    asRecord(rate.GuaranteeInfo);
  const gType = (
    asString(guaranteeBlock?.GuaranteeType) ??
    asString(guaranteeBlock?.GuaranteeTyp) ??
    asString(rate.GuaranteeType) ??
    ""
  ).toUpperCase();

  const depositPolicies = asArray(
    asRecord(guaranteeBlock?.DepositPolicies)?.DepositPolicy ??
      guaranteeBlock?.DepositPolicy,
  );
  const hasDepositAmount = depositPolicies.some((row) => {
    const policy = asRecord(row);
    if (!policy) return false;
    const amountPercent = asRecord(policy.AmountPercent);
    const amount = asNumber(amountPercent?.Amount ?? policy.Amount);
    return amount != null && amount > 0;
  });

  if (gType === "DEP" || gType === "DEPOSIT" || hasDepositAmount) {
    return "deposit";
  }
  if (gType === "GUAR" || gType === "GTG" || gType === "GUARANTEE") {
    return "guarantee";
  }

  const prepaid =
    rate.AdvancePurchase === true ||
    rate.PrepaidIndicator === true ||
    rate.PrepaidIndicator === "true" ||
    rate.prepaid === true;
  const planName = asString(rate.RatePlanName) ?? "";
  const direct =
    asString(rate.GuaranteeDescription) ?? asString(rate.DepositPolicy) ?? "";
  const blob = `${planName} ${direct}`.toLowerCase();

  if (
    prepaid ||
    /prepaid|pay\s*in\s*advance|full\s*payment\s*in\s*advance/.test(blob)
  ) {
    return "prepaid";
  }
  if (
    /pay\s*at\s*(the\s*)?hotel|pay\s*at\s*property|settled\s*at\s*(the\s*)?hotel|postpaid|pay\s*later/.test(
      blob,
    )
  ) {
    return "pay_at_hotel";
  }
  if (/deposit/.test(blob) && !/no\s+deposit/.test(blob)) return "deposit";
  if (/guarantee/.test(blob)) return "guarantee";

  return null;
}

/** Accepted guarantee payment card codes (AX, VI, MC, …). */
export function pickAcceptedPaymentCards(
  rate: Record<string, unknown>,
): string[] {
  const guaranteeBlock =
    asRecord(rate.Guarantee) ??
    asRecord(rate.Guarantees) ??
    asRecord(rate.GuaranteeInfo);
  if (!guaranteeBlock) return [];

  const accepted = asArray(
    asRecord(guaranteeBlock.GuaranteesAccepted)?.GuaranteeAccepted ??
      guaranteeBlock.GuaranteeAccepted,
  );
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const row of accepted) {
    const item = asRecord(row);
    if (!item) continue;
    const cards = asArray(
      asRecord(item.PaymentCards)?.PaymentCard ?? item.PaymentCard,
    );
    for (const cardRow of cards) {
      const card = asRecord(cardRow);
      const code =
        asString(card?.CardCode)?.trim().toUpperCase() ??
        asString(cardRow)?.trim().toUpperCase() ??
        null;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

/** Commissionable / non-commissionable from Sabre Commission block or text. */
export function pickCommissionable(
  rate: Record<string, unknown>,
): boolean | null {
  const commission =
    asRecord(rate.Commission) ?? asRecord(rate.Commissions);
  if (commission) {
    const type = (asString(commission.Type) ?? "").trim().toLowerCase();
    if (type === "none" || type === "noncommissionable" || type === "non") {
      return false;
    }
    const texts = textList(
      asRecord(commission.CommissionDescription)?.Text ??
        commission.Description,
    );
    const blob = `${type} ${texts.join(" ")}`.toLowerCase();
    if (/non[\s-]?commission/.test(blob)) return false;
    if (/commissionable/.test(blob) || type === "percentage" || type === "variable" || type === "amount") {
      return true;
    }
  }
  const direct = asString(rate.CommissionDescription) ?? "";
  if (/non[\s-]?commission/i.test(direct)) return false;
  if (/commissionable/i.test(direct)) return true;
  return null;
}

export function pickLimitedAvailability(
  rate: Record<string, unknown>,
): boolean {
  return (
    asSabreBool(
      rate.LimitedAvailability ??
        rate.limitedAvailability ??
        asRecord(rate.RatePlan)?.LimitedAvailability,
    ) === true
  );
}

/** Per-night amounts from ConvertedRateInfo.Rates.Rate[]. */
export function pickNightlyRates(
  rate: Record<string, unknown>,
): Array<{ start: string; end: string; amount: number; currency: string }> {
  const ratesBlock = asRecord(rate.Rates);
  const rows = asArray(ratesBlock?.Rate ?? rate.Rate);
  const out: Array<{
    start: string;
    end: string;
    amount: number;
    currency: string;
  }> = [];
  for (const row of rows) {
    const night = asRecord(row);
    if (!night) continue;
    const start = asString(night.StartDate);
    const end = asString(night.EndDate);
    const amount =
      asNumber(night.AmountBeforeTax) ??
      asNumber(night.AmountAfterTax) ??
      asNumber(night.Amount);
    const currency =
      asString(night.CurrencyCode) ?? asString(rate.CurrencyCode) ?? "USD";
    if (!start || !end || amount == null || amount < 0) continue;
    out.push({ start, end, amount, currency });
  }
  return out;
}

/** Flatten nested Sabre guarantee / deposit shapes. */
export function pickPayment(rate: Record<string, unknown>): string | null {
  const timing = pickPaymentTiming(rate);
  const direct =
    asString(rate.GuaranteeDescription) ?? asString(rate.DepositPolicy);
  const cards = pickAcceptedPaymentCards(rate);
  const cardsSuffix =
    cards.length > 0 ? ` (${cards.slice(0, 8).join(", ")})` : "";

  const guaranteeBlock =
    asRecord(rate.Guarantee) ??
    asRecord(rate.Guarantees) ??
    asRecord(rate.GuaranteeInfo);

  if (guaranteeBlock) {
    const gType = (
      asString(guaranteeBlock.GuaranteeType) ??
      asString(guaranteeBlock.GuaranteeTyp) ??
      ""
    ).toUpperCase();

    const depositPolicies = asArray(
      asRecord(guaranteeBlock.DepositPolicies)?.DepositPolicy ??
        guaranteeBlock.DepositPolicy,
    );
    let depositLabel: string | null = null;
    for (const row of depositPolicies) {
      const policy = asRecord(row);
      if (!policy) continue;
      const amountPercent = asRecord(policy.AmountPercent);
      const amount = asNumber(amountPercent?.Amount ?? policy.Amount);
      const currency = asString(amountPercent?.CurrencyCode ?? policy.CurrencyCode);
      if (amount != null && amount > 0) {
        depositLabel = `Deposit required (${formatMoney(amount, currency)})`;
        break;
      }
    }

    if (gType === "DEP" || gType === "DEPOSIT" || depositLabel) {
      return depositLabel ?? "Deposit required";
    }
    if (gType === "GUAR" || gType === "GTG" || gType === "GUARANTEE") {
      return `Guarantee required${cardsSuffix}`.trim();
    }

    const fromBlock =
      asString(guaranteeBlock.Description) ??
      (gType ? gType : null) ??
      textFromUnknown(guaranteeBlock);
    if (fromBlock) {
      return cardsSuffix && !/\([A-Z]{2}/.test(fromBlock)
        ? `${fromBlock}${cardsSuffix}`
        : fromBlock;
    }
  }

  const deposit = asRecord(rate.Deposit) ?? asRecord(rate.Deposits);
  if (deposit) {
    return (
      asString(deposit.Description) ??
      asString(deposit.DepositPolicy) ??
      textFromUnknown(deposit)
    );
  }

  const legacyType = asString(rate.GuaranteeType);
  if (legacyType) {
    const upper = legacyType.toUpperCase();
    if (upper === "DEP" || upper === "DEPOSIT") return "Deposit required";
    if (upper === "GUAR" || upper === "GTG") {
      return `Guarantee required${cardsSuffix}`.trim();
    }
    return legacyType;
  }

  if (direct) return direct;
  if (timing === "prepaid") return "Prepaid — pay in advance";
  if (timing === "pay_at_hotel") return "Pay at hotel";
  return null;
}

export function pickRateKey(rate: Record<string, unknown>): string | null {
  return (
    asString(rate.RateKey) ?? asString(asRecord(rate.RateSource)?.RateKey)
  );
}

export function pickInclusions(rate: Record<string, unknown>): string[] {
  const block = asRecord(rate.RatePlanInclusions);
  const rows = asArray(
    block?.RatePlanInclusion ?? rate.RatePlanInclusion ?? rate.Inclusions,
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const text =
      asString(asRecord(row)?.Description) ??
      asString(asRecord(row)?.Name) ??
      textFromUnknown(row);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/** Tax total from ConvertedRateInfo.Taxes when present. */
function pickTaxAmount(rate: Record<string, unknown>): {
  amount: number | null;
  currency: string | null;
} {
  const taxes = asRecord(rate.Taxes);
  return {
    amount: asNumber(taxes?.Amount),
    currency: asString(taxes?.CurrencyCode) ?? asString(rate.CurrencyCode),
  };
}

/** Fee lines (e.g. service charge) for advisor Q&A. */
function pickFeeLines(rate: Record<string, unknown>): string[] {
  const fees = asRecord(rate.Fees);
  const groups = asArray(asRecord(fees?.FeeGroups)?.FeeGroup ?? fees?.FeeGroup);
  const out: string[] = [];
  for (const row of groups) {
    const group = asRecord(row);
    if (!group) continue;
    const label =
      textList(asRecord(group.FeeDescription)?.Text)[0] ??
      asString(group.Description) ??
      "Fee";
    const amount = asNumber(group.Amount);
    const currency = asString(group.CurrencyCode) ?? asString(rate.CurrencyCode);
    if (amount != null && currency) {
      out.push(`${label}: ${formatMoney(amount, currency)}`);
    } else if (label) {
      out.push(label);
    }
  }
  const total = asNumber(fees?.Amount);
  if (out.length === 0 && total != null) {
    const currency = asString(fees?.CurrencyCode) ?? asString(rate.CurrencyCode);
    out.push(`Fees: ${formatMoney(total, currency)}`);
  }
  return out;
}

/** Room extras (crib / rollaway / extra adult) for advisor Q&A. */
function pickRoomExtraLines(rate: Record<string, unknown>): string[] {
  const block = asRecord(rate.RoomExtras);
  const rows = asArray(block?.RoomExtra ?? rate.RoomExtra);
  const out: string[] = [];
  for (const row of rows) {
    const extra = asRecord(row);
    if (!extra) continue;
    const label = asString(extra.Description) ?? textFromUnknown(row);
    if (!label) continue;
    const amount = asNumber(extra.Amount);
    if (amount != null && amount <= 0) {
      out.push(`${label}: free`);
      continue;
    }
    const currency = asString(extra.CurrencyCode) ?? asString(rate.CurrencyCode);
    if (amount != null && currency) {
      out.push(`${label}: ${formatMoney(amount, currency)}`);
    } else {
      out.push(label);
    }
  }
  return out;
}

/** Sabre amenity with include/charge hint from ComplimentaryInd when present. */
export type SabreAmenityFlag = {
  label: string;
  /** true = complimentary; false = may be chargeable; null = unknown. */
  complimentary: boolean | null;
};

function complimentaryFromAmenity(
  amenity: Record<string, unknown> | null,
): boolean | null {
  if (!amenity) return null;
  const value = amenity.ComplimentaryInd;
  if (value === true || value === "true" || value === "True") return true;
  if (value === false || value === "false" || value === "False") return false;
  return null;
}

/** Short room amenities from Sabre Room.Amenities (capped), with charge hints. */
function pickRoomAmenityFlags(
  rate: Record<string, unknown>,
  limit = 8,
): SabreAmenityFlag[] {
  const rows = asArray(asRecord(rate.RoomAmenities)?.Amenity ?? rate.RoomAmenity);
  const out: SabreAmenityFlag[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const amenity = asRecord(row);
    const label = asString(amenity?.Description) ?? textFromUnknown(row);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, complimentary: complimentaryFromAmenity(amenity) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Policy / prepaid blurb for notes under the table (not the room title). */
function pickRateTerms(rate: Record<string, unknown>): string | null {
  const fromTexts = textList(rate.RoomDescriptionTexts).find((t) =>
    looksLikeRatePolicyBlurb(t),
  );
  if (fromTexts) return shortAdvisorBlurb(fromTexts);
  const roomDesc = asRecord(rate.RoomDescription);
  const fromObj = textList(roomDesc?.Text).find((t) => looksLikeRatePolicyBlurb(t));
  return fromObj ? shortAdvisorBlurb(fromObj) : null;
}

/** Flat ConvertedRateInfo / RateInfo arrays (legacy / thin Avail shape). */
export function rateInfosFromHotelRateInfo(
  hotelOrRateBlock: Record<string, unknown>,
): unknown[] {
  const rateInfoBlock =
    asRecord(hotelOrRateBlock.HotelRateInfo) ?? hotelOrRateBlock;
  const rateInfos = asRecord(
    asRecord(rateInfoBlock)?.RateInfos ??
      asRecord(hotelOrRateBlock.RateInfos) ??
      null,
  );
  if (!rateInfos) {
    return asArray(
      hotelOrRateBlock.ConvertedRateInfo ??
        hotelOrRateBlock.RateInfo ??
        hotelOrRateBlock.RoomRate,
    );
  }
  return asArray(
    rateInfos.ConvertedRateInfo ?? rateInfos.RateInfo ?? rateInfos.RoomRate,
  );
}

/** Hotel-level Commission from RateInfos (often missing on per-room ConvertedRateInfo). */
function hotelLevelCommission(
  hotelRateInfo: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const row of rateInfosFromHotelRateInfo(hotelRateInfo)) {
    const rate = asRecord(row);
    const commission =
      asRecord(rate?.Commission) ?? asRecord(rate?.Commissions);
    if (commission) return commission;
  }
  return asRecord(hotelRateInfo.Commission) ?? asRecord(hotelRateInfo.Commissions);
}

/**
 * Prefer Rooms.Room → RatePlans.RatePlan (+ nested ConvertedRateInfo).
 * Falls back to thin RateInfos.ConvertedRateInfo when Rooms is absent.
 * Used for both GetHotelAvail and GetHotelDetails shapes.
 */
export function extractPricedRateRows(
  hotelOrDetails: Record<string, unknown>,
): Record<string, unknown>[] {
  const block =
    asRecord(hotelOrDetails.HotelRateInfo) ?? hotelOrDetails;
  const fromRooms = extractRatesFromRooms(block);
  if (fromRooms.length > 0) {
    const hotelCommission = hotelLevelCommission(block);
    if (!hotelCommission) return fromRooms;
    return fromRooms.map((row) =>
      asRecord(row)?.Commission || asRecord(row)?.Commissions
        ? row
        : { ...row, Commission: hotelCommission },
    );
  }

  return rateInfosFromHotelRateInfo(hotelOrDetails)
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function pickBedType(room: Record<string, unknown>): string | null {
  const options = asRecord(room.BedTypeOptions);
  const groups = asArray(options?.BedTypes ?? room.BedTypes);
  for (const groupRow of groups) {
    const group = asRecord(groupRow);
    const beds = asArray(group?.BedType ?? groupRow);
    for (const bedRow of beds) {
      const bed = asRecord(bedRow);
      const label = asString(bed?.Description) ?? textFromUnknown(bedRow);
      if (!label) continue;
      const count = asNumber(bed?.Count);
      if (count != null && count > 1) return `${count}× ${label}`;
      return label;
    }
  }
  return asString(room.BedType) ?? asString(room.BedTypeDescription);
}

function pickMaxOccupancy(room: Record<string, unknown>): number | null {
  const occupancy = asRecord(room.Occupancy);
  return asNumber(occupancy?.Max ?? occupancy?.Maximum ?? room.MaxOccupancy);
}

function isAdvancePurchase(
  plan: Record<string, unknown>,
  planName: string | null,
): boolean {
  if (plan.PrepaidIndicator === true || plan.PrepaidIndicator === "true") {
    return true;
  }
  return Boolean(planName && /advance\s*purchase|non[\s-]?refundable/i.test(planName));
}

/** Curated hotel amenity codes — keep notes short for advisors. */
const ADVISOR_AMENITY_CODES = new Set([
  48, 54, 68, 71, 77, 198, 223, 228, 259, 2014, 2035, 2036,
]);

export type SabreHotelAdvisorFacts = {
  rating: string | null;
  quality: string | null;
  city: string | null;
  /** Local check-in time from property policies (e.g. "2:00 PM"). */
  check_in_time: string | null;
  /** Local check-out time from property policies (e.g. "12:00 PM"). */
  check_out_time: string | null;
  /** Labels for chips / discover (no charge hint). */
  amenities: string[];
  /** Same amenities with ComplimentaryInd when Sabre sends it. */
  amenity_details: SabreAmenityFlag[];
};

const EMPTY_HOTEL_FACTS: SabreHotelAdvisorFacts = {
  rating: null,
  quality: null,
  city: null,
  check_in_time: null,
  check_out_time: null,
  amenities: [],
  amenity_details: [],
};

/** Sabre policy clocks are often "1400" / "1200" — format for advisors. */
export function formatSabrePolicyClock(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 4) {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const padded = digits.padStart(4, "0");
  const hours24 = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));
  if (
    !Number.isFinite(hours24) ||
    !Number.isFinite(minutes) ||
    hours24 > 23 ||
    minutes > 59
  ) {
    return value.trim();
  }
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function pickPolicyClock(
  propertyInfo: Record<string, unknown> | null | undefined,
  type: "CheckIn" | "CheckOut",
): string | null {
  if (!propertyInfo) return null;
  const policies = asRecord(propertyInfo.Policies);
  for (const row of asArray(policies?.Policy)) {
    const policy = asRecord(row);
    const text = asRecord(policy?.Text) ?? policy;
    if (!text) continue;
    const policyType = asString(text.Type) ?? asString(policy?.Type);
    if (policyType?.toLowerCase() !== type.toLowerCase()) continue;
    const raw =
      asString(text.value) ??
      asString(text.Value) ??
      asString(text.Text) ??
      asString(policy?.value);
    const formatted = formatSabrePolicyClock(raw);
    if (formatted) return formatted;
  }
  return null;
}

/**
 * Compact hotel facts for Trip Builder notes (not a full amenity dump).
 * Pass HotelDescriptiveInfo when present (Details); Avail often nests less.
 */
export function extractHotelAdvisorFacts(
  hotelInfo: Record<string, unknown> | null | undefined,
  descriptiveInfo?: Record<string, unknown> | null,
): SabreHotelAdvisorFacts {
  if (!hotelInfo && !descriptiveInfo) {
    return { ...EMPTY_HOTEL_FACTS };
  }

  const descriptive = asRecord(descriptiveInfo) ?? null;
  const propertyInfo =
    asRecord(descriptive?.PropertyInfo) ??
    asRecord(hotelInfo?.PropertyInfo) ??
    null;

  const rating = asString(hotelInfo?.SabreRating);
  const qualityBlock =
    asRecord(propertyInfo?.PropertyQualityInfo) ??
    asRecord(hotelInfo?.PropertyQualityInfo);
  const quality =
    asArray(qualityBlock?.PropertyQuality)
      .map((row) => asString(asRecord(row)?.Description))
      .find(Boolean) ?? null;

  const location =
    asRecord(descriptive?.LocationInfo) ?? asRecord(hotelInfo?.LocationInfo);
  const address = asRecord(location?.Address);
  const city =
    asString(asRecord(address?.CityName)?.value) ??
    asString(address?.CityName) ??
    null;

  const check_in_time = pickPolicyClock(propertyInfo, "CheckIn");
  const check_out_time = pickPolicyClock(propertyInfo, "CheckOut");

  const amenityRows = asArray(
    asRecord(descriptive?.Amenities ?? hotelInfo?.Amenities)?.Amenity,
  );
  const amenity_details: SabreAmenityFlag[] = [];
  const seen = new Set<string>();
  // Prefer curated codes first, then fill with other labels for Q&A (capped).
  for (const preferCurated of [true, false]) {
    for (const row of amenityRows) {
      const amenity = asRecord(row);
      if (!amenity) continue;
      const code = asNumber(amenity.Code);
      if (preferCurated) {
        if (code == null || !ADVISOR_AMENITY_CODES.has(code)) continue;
      } else if (code != null && ADVISOR_AMENITY_CODES.has(code)) {
        continue;
      }
      const label = asString(amenity.Description);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      amenity_details.push({
        label,
        complimentary: complimentaryFromAmenity(amenity),
      });
      if (amenity_details.length >= 10) break;
    }
    if (amenity_details.length >= 10) break;
  }

  return {
    rating,
    quality,
    city,
    check_in_time,
    check_out_time,
    amenities: amenity_details.map((row) => row.label),
    amenity_details,
  };
}

function extractRatesFromRooms(
  hotelRateInfo: Record<string, unknown>,
): Record<string, unknown>[] {
  const roomsBlock = asRecord(hotelRateInfo.Rooms);
  const rooms = asArray(roomsBlock?.Room ?? hotelRateInfo.Room);
  const out: Record<string, unknown>[] = [];

  for (const roomRow of rooms) {
    const room = asRecord(roomRow);
    if (!room) continue;

    const roomType = asString(room.RoomType);
    const roomDesc = asRecord(room.RoomDescription);
    const roomDescName = asString(roomDesc?.Name);
    const roomDescTexts = textList(roomDesc?.Text);
    const bedType = pickBedType(room);
    const maxOccupancy = pickMaxOccupancy(room);
    const roomAmenities = asRecord(room.Amenities);

    const plansBlock = asRecord(room.RatePlans);
    const plans = asArray(plansBlock?.RatePlan ?? room.RatePlan);

    // Room with no RatePlans — skip (no sellable price).
    if (plans.length === 0) continue;

    for (const planRow of plans) {
      const plan = asRecord(planRow);
      if (!plan) continue;

      const converted =
        asRecord(plan.ConvertedRateInfo) ??
        asRecord(plan.RateInfo) ??
        null;

      const money = converted ?? plan;
      const ratePlanDescription = asRecord(plan.RatePlanDescription);
      const ratePlanName = asString(plan.RatePlanName) ?? roomDescName;

      out.push({
        ...money,
        RateKey:
          asString(money.RateKey) ??
          asString(plan.RateKey) ??
          asString(asRecord(plan.RateSource)?.RateKey),
        RatePlanCode:
          asString(plan.RatePlanCode) ?? asString(money.RatePlanCode),
        RatePlanName: ratePlanName,
        ProductName: ratePlanName,
        RoomType: roomType,
        RoomTypeCode: room.RoomTypeCode,
        BedType: bedType,
        MaxOccupancy: maxOccupancy,
        AdvancePurchase: isAdvancePurchase(plan, ratePlanName),
        PrepaidIndicator: plan.PrepaidIndicator,
        LimitedAvailability:
          plan.LimitedAvailability ?? money.LimitedAvailability ?? null,
        ProductCode: asString(plan.ProductCode) ?? asString(money.ProductCode),
        RatePlanType:
          asString(plan.RatePlanType) ?? asString(money.RatePlanType),
        RatePlanTypeDescription:
          asString(plan.RatePlanTypeDescription) ??
          asString(money.RatePlanTypeDescription),
        Commission: money.Commission ?? plan.Commission ?? null,
        RoomDescription: roomDesc,
        RoomDescriptionTexts: roomDescTexts,
        RatePlanDescriptionTexts: textList(ratePlanDescription?.Text),
        RatePlanInclusions: plan.RatePlanInclusions,
        RoomAmenities: roomAmenities,
        CancelPenalties:
          money.CancelPenalties ?? plan.CancelPenalties ?? null,
        Guarantee: money.Guarantee ?? plan.Guarantee ?? null,
        Taxes: money.Taxes ?? plan.Taxes ?? null,
        Fees: money.Fees ?? plan.Fees ?? null,
        RoomExtras: money.RoomExtras ?? plan.RoomExtras ?? null,
        Rates: money.Rates ?? plan.Rates ?? null,
        HighestNightlyRate:
          asNumber(money.HighestNightlyRate) ??
          asNumber(plan.HighestNightlyRate),
        TaxInclusive: money.TaxInclusive ?? plan.TaxInclusive ?? null,
        AdditionalFeesInclusive:
          money.AdditionalFeesInclusive ??
          plan.AdditionalFeesInclusive ??
          null,
        MealPlanDescription:
          asString(money.MealPlanDescription) ??
          asString(plan.MealPlanDescription),
        MealPlanCode:
          asString(money.MealPlanCode) ?? asString(plan.MealPlanCode),
        BoardCode: asString(money.BoardCode) ?? asString(plan.BoardCode),
        // Name only — Text is policy and must not become the room title.
        RoomRateDescription: roomDescName ? [{ Name: roomDescName }] : undefined,
      });
    }
  }

  return out;
}

export type MapSabreRatesInput = {
  source: Extract<RateSourceCode, "gds_public" | "gds_negotiated">;
  propertyId?: string | null;
  checkIn: string;
  checkOut: string;
  currency?: string;
  hotelCode?: string | null;
  hotelName?: string | null;
  rates: unknown[];
  /** Where the rates came from (avail vs details). */
  shopStep: "avail" | "details";
  /** Optional hotel-level facts for Trip Builder notes. */
  hotelFacts?: SabreHotelAdvisorFacts | null;
};

function quoteDedupeKey(quote: RawRateInput): string {
  const raw = quote.raw ?? {};
  const rateKey = raw.rate_key;
  if (typeof rateKey === "string" && rateKey.trim()) {
    return `key:${rateKey.trim()}`;
  }
  return [
    "fb",
    quote.room_name ?? "",
    quote.board ?? "",
    String(quote.cost_internal ?? ""),
    String(raw.rate_plan_code ?? ""),
  ].join("|");
}

/** Non-refundable vs refundable vs other — for commercial collapse / shortlist. */
export function sabreCancelFamily(
  summary: string | null | undefined,
): "non_refundable" | "refundable" | "other" | "unknown" {
  const text = summary?.trim().toLowerCase() ?? "";
  if (!text) return "unknown";
  if (/non[\s-]?refundable|no refund|no changes|no credit/.test(text)) {
    return "non_refundable";
  }
  if (/free cancel|fully refundable|refundable|cancel(?:lation)? free/.test(text)) {
    return "refundable";
  }
  return "other";
}

/**
 * Display-facing identity — collapses different RateKeys that look the same
 * (same room, board, cost, cancel family, inclusions).
 */
export function sabreCommercialFingerprint(quote: RawRateInput): string {
  const raw = quote.raw ?? {};
  const cost =
    typeof quote.cost_internal === "number" && Number.isFinite(quote.cost_internal)
      ? quote.cost_internal.toFixed(2)
      : "";
  const inclusionList = Array.isArray(quote.inclusions)
    ? quote.inclusions.filter((line): line is string => typeof line === "string")
    : [];
  const inclusions = inclusionList
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
  const plan =
    typeof raw.rate_plan_name === "string"
      ? raw.rate_plan_name.trim().toLowerCase()
      : "";
  // Ignore cryptic codes and loyalty-points-only plans — not commercial diffs for advisors.
  const pointsOnly =
    /\bpoints?\b|\bhonors?\b/i.test(plan) &&
    !/breakfast|percent|%|off|purchase|package|include|meal/i.test(plan);
  const planKey =
    plan.length >= 4 &&
    !pointsOnly &&
    !/^(pick|rate|std|bar|rak|rac)$/i.test(plan) &&
    (/percent|%|off|night|breakfast|purchase|package|member|flex|refund|ap\b/i.test(
      plan,
    ) ||
      /\s/.test(plan) ||
      plan.length >= 12)
      ? plan
      : "";
  return [
    (quote.room_name ?? "").trim().toLowerCase(),
    (quote.board ?? "").trim().toLowerCase(),
    cost,
    raw.advance_purchase === true ? "ap" : "std",
    sabreCancelFamily(quote.cancellation_summary),
    inclusions,
    planKey,
  ].join("|");
}

function quoteRichness(quote: RawRateInput): number {
  let score = 0;
  const hotel = quote.property_name?.trim().toLowerCase() ?? "";
  const room = quote.room_name?.trim().toLowerCase() ?? "";
  if (room && room !== hotel) score += 3;
  if (quote.cancellation_summary) score += 2;
  if (quote.payment_summary) score += 2;
  if (quote.board) score += 1;
  if (Array.isArray(quote.inclusions) && quote.inclusions.length > 0) score += 1;
  if (quote.raw?.rate_key) score += 1;
  if (quote.rate_source_code === "gds_negotiated") score += 1;
  return score;
}

function keepRicherQuote(
  byKey: Map<string, RawRateInput>,
  key: string,
  quote: RawRateInput,
): void {
  const existing = byKey.get(key);
  if (!existing || quoteRichness(quote) > quoteRichness(existing)) {
    byKey.set(key, quote);
  }
}

/** Dedupe by RateKey, then collapse commercial twins; keep the richer advisor row. */
export function dedupeQuotes(quotes: RawRateInput[]): RawRateInput[] {
  const byRateKey = new Map<string, RawRateInput>();
  for (const quote of quotes) {
    keepRicherQuote(byRateKey, quoteDedupeKey(quote), quote);
  }
  const byCommercial = new Map<string, RawRateInput>();
  for (const quote of byRateKey.values()) {
    keepRicherQuote(byCommercial, sabreCommercialFingerprint(quote), quote);
  }
  return [...byCommercial.values()];
}

/** Shared RawRateInput builder for Avail + Details rate lines. */
export function mapRateInfosToQuotes(
  input: MapSabreRatesInput,
): RawRateInput[] {
  const quotes: RawRateInput[] = [];

  for (const rateRow of input.rates) {
    const rate = asRecord(rateRow);
    if (!rate) continue;

    const { amount, currency, averageNightly } = pickAmount(rate);
    if (amount == null || amount <= 0) continue;

    const rateKey = pickRateKey(rate);
    const roomName = pickRoomName(rate);
    // Never show bare hotel name (or a promo plan) as the room label.
    const hotelName = input.hotelName?.trim() ?? null;
    const safeRoomName =
      roomName &&
      hotelName &&
      roomName.toLowerCase() === hotelName.toLowerCase()
        ? asString(rate.RoomTypeCode) ?? "Room"
        : roomName;

    const planDesc = textList(rate.RatePlanDescriptionTexts);
    const roomDesc = textList(rate.RoomDescriptionTexts);
    const rateTerms = pickRateTerms(rate);
    const blurb =
      rateTerms ?? shortAdvisorBlurb(planDesc[0] ?? roomDesc[0] ?? null);
    const facts = input.hotelFacts;
    const tax = pickTaxAmount(rate);
    const feeLines = pickFeeLines(rate);
    const extraLines = pickRoomExtraLines(rate);
    const roomAmenityFlags = pickRoomAmenityFlags(rate);
    const cancelSummary = pickCancellation(rate, input.checkIn);
    const cancelDeadline = pickCancelDeadline(rate, input.checkIn);
    const cancelPenaltyNights = pickCancelPenaltyNights(rate);
    const commissionable = pickCommissionable(rate);
    const acceptedCards = pickAcceptedPaymentCards(rate);
    const limitedAvailability = pickLimitedAvailability(rate);
    const nightlyRates = pickNightlyRates(rate);
    const taxInclusive = asSabreBool(rate.TaxInclusive);
    const feesInclusive = asSabreBool(rate.AdditionalFeesInclusive);
    // Supplier (hotel) currency when Sabre also converted (e.g. JPY → USD).
    const supplierCurrency =
      asString(rate.SupplierCurrencyCode) ??
      asString(rate.OriginalCurrencyCode) ??
      (currency &&
      asString(rate.ConvertedCurrencyCode) &&
      currency !== asString(rate.ConvertedCurrencyCode)
        ? currency
        : null);
    const supplierAmount =
      asNumber(rate.SupplierAmountAfterTax) ??
      asNumber(rate.OriginalAmountAfterTax) ??
      null;

    quotes.push({
      property_id: input.propertyId ?? null,
      property_name: hotelName,
      room_name: safeRoomName,
      board: pickBoard(rate),
      check_in: input.checkIn,
      check_out: input.checkOut,
      currency: currency ?? input.currency ?? "USD",
      cost_internal: amount,
      rate_source_code: input.source,
      inclusions: pickInclusions(rate),
      cancellation_summary: cancelSummary,
      payment_summary: pickPayment(rate),
      availability_status: "available",
      raw: {
        sabre_hotel_code: input.hotelCode ?? null,
        sabre_hotel_name: hotelName,
        rate_key: rateKey,
        rate_plan_code: asString(rate.RatePlanCode),
        rate_plan_name: asString(rate.RatePlanName),
        product_code: asString(rate.ProductCode),
        rate_plan_type: asString(rate.RatePlanType),
        rate_plan_type_description: asString(rate.RatePlanTypeDescription),
        room_type: asString(rate.RoomType),
        bed_type: asString(rate.BedType),
        max_occupancy: asNumber(rate.MaxOccupancy),
        advance_purchase: rate.AdvancePurchase === true,
        payment_timing: pickPaymentTiming(rate),
        accepted_payment_cards: acceptedCards,
        commissionable,
        limited_availability: limitedAvailability,
        cancel_deadline: cancelDeadline,
        cancel_penalty_nights: cancelPenaltyNights,
        average_nightly_rate: averageNightly,
        highest_nightly_rate: asNumber(rate.HighestNightlyRate),
        nightly_rates: nightlyRates,
        amount_after_tax: asNumber(rate.AmountAfterTax),
        amount_before_tax: asNumber(rate.AmountBeforeTax),
        tax_amount: tax.amount,
        tax_currency: tax.currency,
        tax_inclusive: taxInclusive,
        fees_inclusive: feesInclusive,
        supplier_currency: supplierCurrency,
        supplier_amount_after_tax: supplierAmount,
        fee_lines: feeLines,
        room_extra_lines: extraLines,
        room_amenities: roomAmenityFlags.map((row) => row.label),
        room_amenity_details: roomAmenityFlags,
        rate_terms: rateTerms,
        rate_blurb: blurb,
        rate_plan_description: planDesc[0] ?? null,
        room_description: roomDesc[0] ?? null,
        hotel_rating: facts?.rating ?? null,
        hotel_quality: facts?.quality ?? null,
        hotel_city: facts?.city ?? null,
        hotel_check_in_time: facts?.check_in_time ?? null,
        hotel_check_out_time: facts?.check_out_time ?? null,
        hotel_amenities: facts?.amenities ?? [],
        hotel_amenity_details: facts?.amenity_details ?? [],
        supplier: "sabre",
        source: input.source,
        shop_step: input.shopStep,
      },
    });
  }

  return dedupeQuotes(quotes);
}

/** Hard cap after Details map — never persist dozens of near-duplicate Sabre rows. */
const MAX_SABRE_WORKING_SET = 25;
/** Diversity shortlist for rate layer / LLM / compare (UI still takes top 5). */
const MAX_SABRE_SHORTLIST = 12;

function sabreRoomTypeKey(quote: RawRateInput): string {
  const fromRaw =
    typeof quote.raw?.room_type === "string" ? quote.raw.room_type.trim() : "";
  const name = quote.room_name?.trim() || fromRaw || "room";
  return name.toLowerCase();
}

function sabreQuoteCost(quote: RawRateInput): number {
  return typeof quote.cost_internal === "number" &&
    Number.isFinite(quote.cost_internal)
    ? quote.cost_internal
    : Number.POSITIVE_INFINITY;
}

/** Same room + price band — only keep a second if cancel/board/plan differs. */
function sabreSlotKey(quote: RawRateInput): string {
  const cost = sabreQuoteCost(quote);
  const band = Number.isFinite(cost) ? (Math.round(cost * 100) / 100).toFixed(2) : "";
  return [
    sabreRoomTypeKey(quote),
    band,
    (quote.board ?? "").trim().toLowerCase(),
    sabreCancelFamily(quote.cancellation_summary),
    quote.raw?.advance_purchase === true ? "ap" : "std",
  ].join("|");
}

/**
 * Keep a scannable set after Avail+Details merge: cheapest, negotiated,
 * cancel-friendly, distinct room types — never the full Sabre dump.
 */
export function shortlistSabreQuotes(quotes: RawRateInput[]): RawRateInput[] {
  const collapsed = dedupeQuotes(quotes);
  if (collapsed.length <= MAX_SABRE_SHORTLIST) return collapsed;

  const usable = collapsed.filter(
    (quote) =>
      typeof quote.cost_internal === "number" &&
      quote.cost_internal > 0 &&
      quote.availability_status !== "unavailable",
  );
  const pool = (usable.length > 0 ? usable : collapsed)
    .slice()
    .sort((a, b) => {
      const byCost = sabreQuoteCost(a) - sabreQuoteCost(b);
      if (byCost !== 0) return byCost;
      const aNeg = a.rate_source_code === "gds_negotiated" ? 0 : 1;
      const bNeg = b.rate_source_code === "gds_negotiated" ? 0 : 1;
      return aNeg - bNeg;
    })
    .slice(0, MAX_SABRE_WORKING_SET);

  if (pool.length <= MAX_SABRE_SHORTLIST) return pool;

  const picked: RawRateInput[] = [];
  const seen = new Set<RawRateInput>();
  const seenSlots = new Set<string>();
  const take = (quote: RawRateInput | undefined) => {
    if (!quote || seen.has(quote) || picked.length >= MAX_SABRE_SHORTLIST) {
      return;
    }
    const slot = sabreSlotKey(quote);
    if (seenSlots.has(slot)) return;
    seen.add(quote);
    seenSlots.add(slot);
    picked.push(quote);
  };

  take(pool[0]);
  take(pool.find((quote) => quote.rate_source_code === "gds_negotiated"));
  take(
    pool.find(
      (quote) =>
        sabreCancelFamily(quote.cancellation_summary) === "refundable" &&
        !seen.has(quote),
    ),
  );
  take(
    pool.find(
      (quote) =>
        Boolean(quote.cancellation_summary?.trim()) && !seen.has(quote),
    ),
  );

  const seenTypes = new Set(picked.map(sabreRoomTypeKey));
  for (const quote of pool) {
    if (picked.length >= MAX_SABRE_SHORTLIST) break;
    const key = sabreRoomTypeKey(quote);
    if (seenTypes.has(key)) continue;
    seenTypes.add(key);
    take(quote);
  }

  for (const quote of pool) {
    if (picked.length >= MAX_SABRE_SHORTLIST) break;
    take(quote);
  }

  return picked;
}

/** One short advisor line — never a full Sabre paragraph. */
function shortAdvisorBlurb(text: string | null): string | null {
  if (!text?.trim()) return null;
  const first = text.split(/\n|(?<=\.)\s+/)[0]?.trim() ?? text.trim();
  if (first.length <= 110) return first;
  return `${first.slice(0, 109).trimEnd()}…`;
}

/** True when cancel text is bare "Free cancel" with no until-date / deadline. */
function cancelSummaryNeedsDeadline(summary: string | null | undefined): boolean {
  const text = summary?.trim() ?? "";
  if (!text) return true;
  if (/until\s+\d/i.test(text) || /\d{4}-\d{2}-\d{2}/.test(text)) return false;
  return /^free cancel\b/i.test(text) && !/until/i.test(text);
}

/** True when Avail quotes need Details (missing RateKey and/or policies). */
export function availNeedsDetailsEnrichment(quotes: RawRateInput[]): boolean {
  if (quotes.length === 0) return false;
  return quotes.some((quote) => {
    const rateKey = quote.raw?.rate_key;
    const hasKey = typeof rateKey === "string" && Boolean(rateKey.trim());
    const hasDeadline =
      typeof quote.raw?.cancel_deadline === "string" &&
      Boolean(quote.raw.cancel_deadline.trim());
    return (
      !hasKey ||
      !quote.cancellation_summary ||
      !quote.payment_summary ||
      (cancelSummaryNeedsDeadline(quote.cancellation_summary) && !hasDeadline)
    );
  });
}

/**
 * Merge Details + Avail: prefer richer row per RateKey.
 */
export function mergeAvailAndDetailsQuotes(
  availQuotes: RawRateInput[],
  detailsQuotes: RawRateInput[],
): RawRateInput[] {
  return dedupeQuotes([...detailsQuotes, ...availQuotes]);
}
