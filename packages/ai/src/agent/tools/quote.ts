import { z } from "zod";

import type { TripFacts } from "../../types";

import { defineAgentTool } from "./define-tool";

const hotelName = z.string().trim().min(2).max(120);
const roomName = z.string().trim().min(1).max(120);

/** Open the rebuilt options PDF when a change result includes a signed URL. */
function quotePreviewFromChange(result: unknown): { url: string } | null {
  if (!result || typeof result !== "object") return null;
  const row = result as { url?: unknown };
  return typeof row.url === "string" && row.url ? { url: row.url } : null;
}

const quoteOption = z
  .object({
    hotel: hotelName,
    room: roomName,
    markup_percent: z.number().min(0).max(100).optional(),
    client_price: z.number().min(0).optional(),
    currency: z.string().trim().length(3).optional(),
    rank: z.number().int().min(1).max(20).optional(),
    /** From the last rates_search card when the advisor taps Add. */
    rate_ref: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (row) => row.markup_percent != null || row.client_price != null || row.rate_ref != null,
    "Each option needs a markup_percent, client_price, or rate_ref.",
  );

export const quoteAddOptionsTool = defineAgentTool({
  name: "quote_add_options",
  description: [
    "Add any number of rooms from any number of hotels to the options quote in one call, each with a markup percent or a client price.",
    "Use when the advisor names rooms and prices or markups together, e.g. \"Beach Villa at 30% and Water Villa at 25%, for all 3 hotels\", or \"add the first two suggested rooms\".",
    "If the stay has no hotel yet, this sets the room's hotel on the stay automatically. Does not overwrite a different hotel already on the stay.",
    "A markup below the hotel's minimum is applied and flagged once in the summary — never call deliberate prices typos.",
    "Do not use to send the quote (quote_send) or to change only wording (quote_set_wording / quote_edit_lines).",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z.object({ options: z.array(quoteOption).min(1).max(20) }).strict(),
  risk: "undo",
  progress: () => "Adding rooms to the quote…",
  quickReply: true,
  run: (input, handlers, call) =>
    handlers.addQuoteOptions(
      {
        options: input.options.map((row) => ({
          hotel: row.hotel,
          room: row.room,
          markupPercent: row.markup_percent,
          clientPrice: row.client_price,
          currency: row.currency,
          rank: row.rank,
          rateRef: row.rate_ref,
        })),
      },
      call,
    ),
});

export const quoteSetClientPriceTool = defineAgentTool({
  name: "quote_set_client_price",
  description: [
    "Set the client price on one or more rooms already on the options quote, in one call.",
    "Use when the advisor changes prices already on the quote. Do not use to add a new room (quote_add_options).",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      prices: z
        .array(
          z
            .object({
              hotel: hotelName,
              room: roomName,
              client_price: z.number().min(0),
              currency: z.string().trim().length(3).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  risk: "undo",
  progress: () => "Updating client prices…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.setQuoteClientPrices(
      {
        prices: input.prices.map((row) => ({
          hotel: row.hotel,
          room: row.room,
          clientPrice: row.client_price,
          currency: row.currency,
        })),
      },
      call,
    ),
});

export const quoteRemoveOptionTool = defineAgentTool({
  name: "quote_remove_option",
  description: [
    "Remove rooms from the options quote: one room, several, or every room (clear_all).",
    "Use when the advisor drops rooms, clears the quote options, or wants hotels cleared after rooms are gone.",
    "Works on rooms that were the client's choice while the quote is still editable (not pricing-locked).",
    "To clear hotels on stays after rooms are gone, use trip_set_stays with hotel null — that also drops any rooms still labelled with that hotel.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      hotel: hotelName.optional(),
      room: roomName.optional(),
      options: z
        .array(z.object({ hotel: hotelName, room: roomName }).strict())
        .min(1)
        .max(20)
        .optional(),
      clear_all: z.boolean().optional().describe("true to remove every room on the options quote."),
    })
    .strict()
    .refine(
      (row) =>
        row.clear_all === true ||
        (row.options != null && row.options.length > 0) ||
        (row.hotel != null && row.room != null),
      "Pass clear_all, options, or hotel+room.",
    ),
  risk: "undo",
  progress: (input) =>
    input.clear_all ? "Clearing rooms from the quote…" : "Removing rooms from the quote…",
  quickReply: true,
  run: (input, handlers, call) =>
    handlers.removeQuoteOption(
      {
        hotel: input.hotel,
        room: input.room,
        options: input.options,
        clearAll: input.clear_all,
      },
      call,
    ),
});

export const quoteSetWordingTool = defineAgentTool({
  name: "quote_set_wording",
  description: [
    "Set the options quote title and/or closing note for the client PDF.",
    "Use when the advisor sets the quote title or note. Do not use for room prices (quote_set_client_price) or other PDF lines (quote_edit_lines).",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      notes: z.string().trim().min(1).max(4000).optional(),
    })
    .strict()
    .refine((row) => row.title != null || row.notes != null, "Pass title and/or notes."),
  risk: "undo",
  progress: () => "Updating the quote wording…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.setQuoteWording({ title: input.title, notes: input.notes }, call),
});

export const quoteListLinesTool = defineAgentTool({
  name: "quote_list_lines",
  description: [
    "List the printable lines on the options quote PDF (title, rooms, inclusions, arrival, transfers, terms, note).",
    "Use before rewriting a specific line when you need its id. Header and footer are not listed and cannot change.",
    "Do not use to change lines (quote_edit_lines) or to open the PDF (quote_preview).",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Reading the options quote…",
  run: (_input, handlers) => handlers.listQuoteLines(),
});

export const quoteEditLinesTool = defineAgentTool({
  name: "quote_edit_lines",
  description: [
    "Rewrite specific client wording on the options quote PDF: board, inclusions, arrival, transfers, cancel/payment, notice, or other printable lines.",
    "Every lines entry MUST include both id and the full new text. Call quote_list_lines first when you need ids.",
    "Use find+replace for the same words everywhere (e.g. \"10% SC\" → the long client sentence).",
    "For \"make What's included clear\" / plain English on a whole section, prefer quote_rewrite_section.",
    "Client-facing only: never put team cost, markup, booking codes or bank details on the PDF. Letterhead stays fixed.",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Do not use for title/note only (quote_set_wording) or prices (quote_set_client_price). Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      lines: z
        .array(
          z
            .object({
              id: z.string().trim().min(1).max(120),
              text: z.string().trim().min(1).max(2000),
            })
            .strict(),
        )
        .min(1)
        .max(40)
        .optional(),
      find: z.string().trim().min(2).max(200).optional(),
      replace: z.string().trim().min(1).max(500).optional(),
    })
    .strict()
    .refine(
      (row) =>
        (row.lines != null && row.lines.length > 0) ||
        (row.find != null && row.replace != null),
      "Pass lines with id and text, or find and replace.",
    ),
  risk: "undo",
  progress: () => "Updating the options quote wording…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.editQuoteLines(
      {
        lines: input.lines,
        find: input.find,
        replace: input.replace,
      },
      call,
    ),
});

export const quoteRewriteSectionTool = defineAgentTool({
  name: "quote_rewrite_section",
  description: [
    "Expand supplier shorthand on the options quote into clear client English (SC, GST, HB, green tax, seaplane, and similar).",
    "Use when the advisor asks to make What's included, board, transfers, or the quote wording client-friendly — without naming each line.",
    "section inclusions = What's included; client_wording = inclusions + board + transfers + arrival + shared + terms + notice.",
    "Optional hotel or room narrows the scope. Letterhead stays fixed.",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Do not use for a single custom sentence the advisor dictated (quote_edit_lines) or title/note only (quote_set_wording).",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      section: z.enum([
        "inclusions",
        "board",
        "transfers",
        "arrival",
        "shared",
        "terms",
        "notice",
        "client_wording",
      ]),
      hotel: hotelName.optional(),
      room: roomName.optional(),
    })
    .strict(),
  risk: "undo",
  progress: () => "Rewriting quote wording for the client…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.rewriteQuoteSection(
      {
        section: input.section,
        hotel: input.hotel,
        room: input.room,
      },
      call,
    ),
});

export const quotePreviewTool = defineAgentTool({
  name: "quote_preview",
  description: [
    "Open the options quote PDF for the advisor (builds it when needed).",
    "Use when they ask to show, open, view, preview or regenerate the options quote.",
    "After quote_edit_lines, quote_rewrite_section, quote_set_wording or quote_set_client_price the PDF already rebuilds and opens — do not call this again in the same turn unless they ask.",
    "Pass force true when they ask to regenerate, or when opening after other quote changes that did not auto-preview.",
    "Do not use to send the quote (quote_send). The browser opens the file; return a short confirmation.",
  ].join(" "),
  schema: z
    .object({
      force: z.boolean().optional().describe("true to rebuild even when the file already matches."),
    })
    .strict(),
  risk: "read",
  progress: (input) =>
    input.force ? "Rebuilding the options quote…" : "Opening the options quote…",
  quotePreview: quotePreviewFromChange,
  run: (input, handlers) => handlers.previewQuote({ force: input.force }),
});

export const ratesUsePastedQuoteTool = defineAgentTool({
  name: "rates_use_pasted_quote",
  description: [
    "Add a room from a pasted supplier quote when PureLuxe has no contracted rate.",
    "Use when the advisor pastes a supplier total, or when rates_search returned no_rates and they want to paste.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      hotel: hotelName,
      room: roomName.default("Room"),
      paste_text: z.string().trim().min(3).max(8000),
      client_price: z.number().min(0).optional(),
      currency: z.string().trim().length(3).optional(),
    })
    .strict(),
  risk: "undo",
  progress: () => "Using the pasted quote…",
  quickReply: true,
  run: (input, handlers, call) =>
    handlers.usePastedQuote(
      {
        hotel: input.hotel,
        room: input.room,
        pasteText: input.paste_text,
        clientPrice: input.client_price,
        currency: input.currency,
      },
      call,
    ),
});

function sendConfirm(trip: TripFacts | null): string {
  const name = trip?.client?.display_name?.trim() || "the client";
  const count = trip?.rates?.candidates?.filter((row) => !row.selected).length ?? 0;
  const options = count > 0 ? `${count} option${count === 1 ? "" : "s"}` : "the options";
  return `Send ${options} to ${name}?`;
}

export const quoteSendTool = defineAgentTool({
  name: "quote_send",
  description: [
    "Send the options quote to the client. This is the only step that asks for confirmation from typed text.",
    "Use when the advisor asks to send the quote. A labelled \"Send … options to …\" tap is already the approval and sends at once.",
    "Do not use to add rooms (quote_add_options). Returns a summary when sent.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "approval",
  progress: () => "Sending the quote…",
  quickReply: true,
  confirm: (_input, trip) => sendConfirm(trip),
  run: (_input, handlers, call) => handlers.sendQuote(call),
});
