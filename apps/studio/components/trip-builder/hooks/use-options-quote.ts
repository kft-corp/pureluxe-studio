"use client";

import {
  generateTripBuilderOptionsQuote,
  getTripBuilderOptionsQuoteUrl,
  updateTripBuilderOptionsQuote,
  proposeTripBuilderOptionsEdit,
} from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import { isQuoteWithClient } from "@/lib/trips/trip-status";

import { clipQuoteLine, sendHandoff } from "../trip-builder-copy";
import type { OptionsTextEdit } from "../trip-builder-helpers";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** The options quote PDF: its wording, line edits, and opening or rebuilding it. */
export function useOptionsQuote(core: TripCore, chat: TripChat) {
  const {
    detail,
    setDetail,
    canWrite,
    quoteFrozen,
    setBusy,
    setQuietChips,
    setOffer,
    closeOffer,
  } = core;
  const {
    appendTurn,
  } = chat;

  function offerOptionsText(edit: OptionsTextEdit, userLine: string) {
    setOffer({ type: "options-text", edit });
    setQuietChips(false);
    const label = edit.field === "title" ? "Set options title" : "Set options note";
    void appendTurn(
      userLine,
      `Save this ${edit.field} on the options quote?\n\n${edit.value}\n\nSay **yes** or tap **${label}**. Say **no** to cancel.`,
    );
  }

  async function commitOptionsText(
    edit: { field: "title" | "notes"; value: string },
    userLine: string,
  ) {
    if (!canWrite || !detail) return;
    setBusy(true);
    setOffer(null);
    try {
      const response = await updateTripBuilderOptionsQuote(detail.trip.id, {
        ...(edit.field === "title" ? { title: edit.value } : { notes: edit.value }),
      });
      setDetail(response.data);
      appendTurn(
        userLine,
        `Saved the options ${edit.field}. Say **show the options quote** to see it.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commitPdfEdits(
    matches: { id: string; label: string; before: string; after: string }[],
    userLine: string,
  ) {
    if (!canWrite || !detail || matches.length === 0) return;
    setBusy(true);
    setOffer(null);
    try {
      const response = await updateTripBuilderOptionsQuote(detail.trip.id, {
        line_edits: matches.map((row) => ({ id: row.id, text: row.after })),
      });
      setDetail(response.data);
      const changed = matches.length === 1 ? "that line" : `${matches.length} lines`;
      appendTurn(
        userLine,
        `Saved ${changed} on the options quote. Say **show the options quote** to open the new PDF.`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function offerPdfEdit(message: string): Promise<boolean> {
    if (!detail) return false;
    setBusy(true);
    try {
      const response = await proposeTripBuilderOptionsEdit(detail.trip.id, message);
      const proposal = response.data;
      if (proposal.kind === "skip") return false;
      if (proposal.kind === "none") {
        void appendTurn(message, proposal.message);
        return true;
      }
      const matches = proposal.matches.map((row) => ({
        id: row.id,
        label: row.label,
        before: row.text,
        after: row.after,
      }));
      if (matches.length === 0) {
        void appendTurn(message, "That text is not on the options quote.");
        return true;
      }
      setOffer({ type: "options-edit", matches });
      setQuietChips(false);
      if (matches.length === 1) {
        const row = matches[0]!;
        const from = row.before ? `${clipQuoteLine(row.before)} → ` : "";
        void appendTurn(
          message,
          `Change this line?\n\n**${row.label}**\n${from}${clipQuoteLine(row.after)}\n\nSay **yes** or tap **Change this line**. Say **no** to cancel.`,
        );
        return true;
      }
      const list = matches
        .map((row) => {
          const from = row.before ? `${clipQuoteLine(row.before)} → ` : "";
          return `- **${row.label}**: ${from}${clipQuoteLine(row.after)}`;
        })
        .join("\n");
      void appendTurn(
        message,
        `That text is on ${matches.length} lines. Change every line, or only one?\n\n${list}\n\nSay **yes** to change every line. Say **no** to cancel.`,
      );
      return true;
    } catch (error) {
      showApiError(error);
      return true;
    } finally {
      setBusy(false);
    }
  }

  function offerOptionsPreview(userLine: string) {
    if (!detail) return;
    const doc = detail.options_quote.document;
    const ready = doc?.status === "ready" && Boolean(doc.has_file);
    const canRebuild = detail.rates.candidates.length > 0;
    if (!canRebuild && !doc?.has_file) {
      void appendTurn(
        userLine,
        "Add a room first. Say **add** and the room name, then the client price.",
      );
      return;
    }
    if (ready || doc?.has_file) {
      void openOptionsQuote(userLine);
      return;
    }
    setOffer({ type: "options-preview" });
    setQuietChips(false);
    void appendTurn(
      userLine,
      "I'll build the options quote from the rooms saved so far. A missing client price prints as To be confirmed.\n\nSay **yes** or tap **Open options quote**. Say **no** to cancel.",
    );
  }

  async function openOptionsQuote(userLine?: string) {
    if (!detail) return;
    closeOffer("options-preview");
    const doc = detail.options_quote.document;
    const ready = doc?.status === "ready" && Boolean(doc.has_file);
    const canRebuild = detail.rates.candidates.length > 0;
    if (!canRebuild && !doc?.has_file) {
      if (userLine) {
        void appendTurn(userLine, "Add a room first. Say **add** and the room name.");
      }
      return;
    }
    // A sent or accepted quote opens as it is. Rebuilding it would replace the PDF the client has.
    const keepSent = quoteFrozen || isQuoteWithClient(detail.trip.status);
    if (keepSent && !doc?.has_file) {
      if (userLine) void appendTurn(userLine, "There is no options quote file on this trip yet.");
      return;
    }
    setBusy(true);
    try {
      if (canWrite && canRebuild && !ready && !keepSent) {
        const generated = await generateTripBuilderOptionsQuote(detail.trip.id, {
          force: true,
        });
        setDetail(generated.data);
      }
      const response = await getTripBuilderOptionsQuoteUrl(detail.trip.id);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      if (userLine) {
        appendTurn(
          userLine,
          keepSent
            ? "This is the options quote the client has."
            : `The options quote is open. A room with no client price prints as To be confirmed.${sendHandoff(detail)}`,
        );
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateOptionsQuote(userLine = "Regenerate options quote") {
    if (!canWrite || !detail) return;
    if (quoteFrozen) {
      void appendTurn(
        userLine,
        `The client accepted this quote, so the PDF stays as sent. To change it, open the [trip page](${pageRoutes.trip(detail.trip.id)}) and choose **Reopen quote** under Update status.`,
      );
      return;
    }
    if (detail.rates.candidates.length === 0) {
      void appendTurn(userLine, "Add a room first. Then the options quote can be rebuilt.");
      return;
    }
    const wasWithClient = isQuoteWithClient(detail.trip.status);
    setBusy(true);
    closeOffer("options-preview");
    try {
      const generated = await generateTripBuilderOptionsQuote(detail.trip.id, { force: true });
      setDetail(generated.data);
      const response = await getTripBuilderOptionsQuoteUrl(detail.trip.id);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      appendTurn(
        userLine,
        wasWithClient
          ? `The options quote is rebuilt and open. The client has the old one, so the trip is back to **Building**.${sendHandoff(generated.data)}`
          : `The options quote is rebuilt and open.${sendHandoff(generated.data)}`,
      );
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return {
    offerOptionsText,
    commitOptionsText,
    commitPdfEdits,
    offerPdfEdit,
    offerOptionsPreview,
    openOptionsQuote,
    regenerateOptionsQuote,
  };
}

