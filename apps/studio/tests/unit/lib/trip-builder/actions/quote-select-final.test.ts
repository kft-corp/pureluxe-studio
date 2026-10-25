import { describe, expect, it } from "vitest";

import {
  isQuoteSelectFinalUndo,
  QUOTE_SELECT_FINAL_UNDO,
  type QuoteSelectFinalUndoPayload,
} from "@/lib/trip-builder/actions/quote-changes";

/** Stage 4: Undo payload shape for quote_select_final (booking reverse path). */
describe("quote_select_final undo payload (Stage 4)", () => {
  it("recognises a valid select-final undo payload", () => {
    const payload: QuoteSelectFinalUndoPayload = {
      kind: QUOTE_SELECT_FINAL_UNDO,
      leg_id: "leg-1",
      line_item_id: "li-1",
      previous_selected_id: null,
      previous_status: "quote_sent",
    };
    expect(isQuoteSelectFinalUndo(payload)).toBe(true);
  });

  it("rejects trip-shape payloads and incomplete rows", () => {
    expect(isQuoteSelectFinalUndo({ lead_client_id: null, stays: [] })).toBe(false);
    expect(isQuoteSelectFinalUndo({ kind: QUOTE_SELECT_FINAL_UNDO })).toBe(false);
    expect(isQuoteSelectFinalUndo(null)).toBe(false);
  });
});
