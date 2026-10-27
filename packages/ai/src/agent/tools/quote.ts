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
    "Add or update any number of rooms from any number of hotels on the options quote in one call, each with a markup percent or a client price.",
    "Use when the advisor names rooms and prices or markups together, e.g. \"Beach Villa at 30% and Water Villa at 25%, for all 3 hotels\", \"add the first two suggested rooms\", or \"make the Kihavah water villa 10% instead\".",
    "Pass absolute client prices exactly as stated — never multiply by the trip's room count or by nights, and never treat a figure as per-room unless the advisor said so. Pass percentage markups as markup_percent.",
    "Call once with every room in this message; do not call again for the same ask.",
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
    "Set the absolute client price on one or more rooms already on the options quote, in one call.",
    "Use when the advisor gives a money amount for a room already on the quote. Do not use for a markup percent only (quote_add_options with markup_percent) or to add a new room (quote_add_options).",
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
    "Rewrite or delete specific client wording on the options quote PDF: board, inclusions, arrival, transfers, cancel/payment, notice, or other printable lines.",
    "Call quote_list_lines first when you need ids. Pass lines with id and the full new text to rewrite; pass delete_ids (or lines with empty text) to remove a deletable line.",
    "Cannot delete titles, hotel/room names, prices, or letterhead — use quote_clear_section to wipe a whole section, quote_add_lines to append bullets.",
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
              text: z.string().max(2000),
            })
            .strict(),
        )
        .min(1)
        .max(40)
        .optional(),
      delete_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(40).optional(),
      find: z.string().trim().min(2).max(200).optional(),
      replace: z.string().trim().min(1).max(500).optional(),
    })
    .strict()
    .refine(
      (row) =>
        (row.lines != null && row.lines.length > 0) ||
        (row.delete_ids != null && row.delete_ids.length > 0) ||
        (row.find != null && row.replace != null),
      "Pass lines with id and text, delete_ids, or find and replace.",
    ),
  risk: "undo",
  progress: () => "Updating the options quote wording…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.editQuoteLines(
      {
        lines: input.lines,
        delete_ids: input.delete_ids,
        find: input.find,
        replace: input.replace,
      },
      call,
    ),
});

const quoteListSection = z.enum([
  "inclusions",
  "extras",
  "arrival",
  "transfers",
  "shared",
]);

export const quoteAddLinesTool = defineAgentTool({
  name: "quote_add_lines",
  description: [
    "Add one or more bullets to a list section on the options quote PDF: inclusions, extras (This room), arrival, transfers, or shared (For every room).",
    "Use when the advisor wants a new line in What's included or similar. Pass hotel (and room for inclusions/extras) when more than one is on the quote.",
    "Cannot change letterhead, header, footer, or brand. Do not use to rewrite an existing line (quote_edit_lines) or clear a section (quote_clear_section).",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      lines: z
        .array(
          z
            .object({
              section: quoteListSection,
              text: z.string().trim().min(1).max(2000),
              hotel: hotelName.optional(),
              room: roomName.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
  risk: "undo",
  progress: () => "Adding lines to the options quote…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.addQuoteLines(
      {
        lines: input.lines.map((row) => ({
          section: row.section,
          text: row.text,
          hotel: row.hotel,
          room: row.room,
        })),
      },
      call,
    ),
});

export const quoteClearSectionTool = defineAgentTool({
  name: "quote_clear_section",
  description: [
    "Remove every line in one options quote PDF section: inclusions, extras, arrival, transfers, shared, notice, notes, board, or terms.",
    "Use when the advisor wants a whole section gone (e.g. clear What's included, drop all transfers). Optional hotel or room narrows the scope.",
    "Letterhead, header, footer, and brand stay fixed. To delete one line only, use quote_edit_lines with delete_ids. To add lines, use quote_add_lines.",
    "On success the PDF is rebuilt and opened automatically — do not call quote_preview again unless they ask to open it again.",
    "Returns a summary; the advisor gets Undo.",
  ].join(" "),
  schema: z
    .object({
      section: z.enum([
        "inclusions",
        "extras",
        "arrival",
        "transfers",
        "shared",
        "notice",
        "notes",
        "board",
        "terms",
      ]),
      hotel: hotelName.optional(),
      room: roomName.optional(),
    })
    .strict(),
  risk: "undo",
  progress: () => "Clearing that section on the options quote…",
  quickReply: true,
  quotePreview: quotePreviewFromChange,
  run: (input, handlers, call) =>
    handlers.clearQuoteSection(
      {
        section: input.section,
        hotel: input.hotel,
        room: input.room,
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
    "After quote_edit_lines, quote_add_lines, quote_clear_section, quote_rewrite_section, quote_set_wording or quote_set_client_price the PDF already rebuilds and opens — do not call this again in the same turn unless they ask.",
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
    "Add a room from a pasted supplier quote when there is no contracted rate.",
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

export const quoteSelectFinalTool = defineAgentTool({
  name: "quote_select_final",
  description: [
    "Record the client's final room from the options quote. Creates a pending hotel booking; Undo cancels it (or restores the previous room).",
    "Use when the advisor says the client picked a room, chose an option, or went with a named villa — e.g. \"Aarav picked the water villa at Kihavah\", \"they chose option 2\".",
    "Do not use to send the quote (quote_send), add rooms (quote_add_options), or change prices. The room must already be on the quote.",
    "Runs immediately with Undo — no Confirm card. Returns a summary.",
  ].join(" "),
  schema: z.object({ hotel: hotelName, room: roomName }).strict(),
  risk: "undo",
  progress: () => "Recording the client's room…",
  quickReply: true,
  run: (input, handlers, call) =>
    handlers.selectFinal({ hotel: input.hotel, room: input.room }, call),
});
