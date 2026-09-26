import {
  findTripById,
  findTripLegById,
  getRateSourcesSetting,
  insertTripLineItem,
  type TripLineItem,
} from "@pureluxe/db";
import {
  checkOfflineAvailability,
  normalizeRate,
  parseOfflineQuote,
  toLineItemFields,
} from "@pureluxe/rates";
import { AppError, rateMessages, type PasteLineItemBody } from "@pureluxe/shared";

/**
 * Paste → parse → normalize → trip_line_items pending_review.
 * Uses the same option → line-item shape as searchRatesForLeg.
 */
export async function pasteTripLineItem(
  input: PasteLineItemBody,
  actor: { memberId: string },
): Promise<TripLineItem> {
  const trip = await findTripById(input.trip_id);
  if (!trip) {
    throw new AppError({
      userMessage: rateMessages.error.tripNotFound,
      code: "rates.trip_not_found",
      status: 404,
    });
  }

  if (input.leg_id) {
    const leg = await findTripLegById(input.leg_id);
    if (!leg || leg.trip_id !== input.trip_id) {
      throw new AppError({
        userMessage: rateMessages.error.legNotFound,
        code: "rates.leg_not_found",
        status: 404,
      });
    }
  }

  const setting = await getRateSourcesSetting();

  if (
    !setting.allow_offline_paste ||
    setting.sources.offline_manual?.enabled !== true
  ) {
    throw new AppError({
      userMessage: rateMessages.error.pasteDisabled,
      code: "rates.paste_disabled",
      status: 403,
    });
  }

  const parsed = parseOfflineQuote({
    paste_text: input.paste_text,
    check_in: input.check_in,
    check_out: input.check_out,
    currency: input.currency,
    property_id: input.property_id,
    property_name: input.property_name,
    rate_source_code: "offline_manual",
  });

  if (!parsed.fields) {
    throw new AppError({
      userMessage: rateMessages.error.pasteParseFailed,
      code: "rates.paste_parse_failed",
      status: 400,
    });
  }

  const option = normalizeRate(parsed.fields, {
    check_in: input.check_in,
    check_out: input.check_out,
    currency: input.currency ?? setting.default_currency,
    property_id: input.property_id ?? null,
  });

  const availability = await checkOfflineAvailability({
    property_id: option.property_id ?? input.property_id,
    check_in: input.check_in,
    check_out: input.check_out,
    setting,
  });

  const annotated = {
    ...option,
    property_name: option.property_name ?? input.property_name,
    raw: {
      ...option.raw,
      availability_check: availability.status,
      availability_message: availability.message,
      parse_warnings: parsed.warnings,
      parse_status: parsed.status,
    },
  };

  const draft = toLineItemFields(annotated);
  const title = input.title?.trim() || draft.title;

  return insertTripLineItem({
    trip_id: input.trip_id,
    leg_id: input.leg_id,
    category: draft.category,
    title,
    subtitle: draft.subtitle,
    details: draft.details,
    property_id: draft.property_id,
    property_name: draft.property_name,
    currency: draft.currency,
    cost_internal: draft.cost_internal,
    rate_source_code: draft.rate_source_code,
    inclusions: draft.inclusions,
    cancellation_policy: draft.cancellation_policy,
    payment_policy: draft.payment_policy,
    status: "pending_review",
    source: "manual",
    raw_input: input.paste_text,
    extracted_json: draft.extracted,
    created_by_id: actor.memberId,
  });
}
