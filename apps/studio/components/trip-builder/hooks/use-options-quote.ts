"use client";

import {
  generateTripBuilderOptionsQuote,
  getTripBuilderOptionsQuoteUrl,
} from "@/lib/api";
import { showApiError } from "@/lib/feedback";
import { pageRoutes } from "@/lib/routes";
import { isQuoteWithClient } from "@/lib/trips/trip-status";

import { sendHandoff } from "../trip-builder-copy";

import type { TripChat } from "./use-trip-chat";
import type { TripCore } from "./use-trip-core";

/** Open or rebuild the options quote PDF from the summary panel. Wording edits go through the agent. */
export function useOptionsQuote(core: TripCore, chat: TripChat) {
  const { detail, setDetail, canWrite, quoteFrozen, setBusy, closeOffer } = core;
  const { appendTurn } = chat;

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
            : `The options quote is open. A room with no sell prints as To be confirmed.${sendHandoff(detail)}`,
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
    openOptionsQuote,
    regenerateOptionsQuote,
  };
}
