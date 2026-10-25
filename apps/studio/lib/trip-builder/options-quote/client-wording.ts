/**
 * Supplier shorthand → client sentences on the options quote PDF.
 * Used when building the document and when the agent asks to rewrite sections.
 */

const EXACT: Record<string, string> = {
  breakfast: "Daily breakfast",
  "daily breakfast": "Daily breakfast",
  hb: "Half Board: dinner included each evening as well as breakfast",
  "half board": "Half Board: dinner included each evening as well as breakfast",
  "dinner hb": "Half Board: dinner included each evening as well as breakfast",
  "dinner (half board)": "Half Board: dinner included each evening as well as breakfast",
  "dinner and transfers": "Half Board and return seaplane transfers, as listed below",
  fb: "Full Board: breakfast, lunch and dinner included",
  "full board": "Full Board: breakfast, lunch and dinner included",
  bb: "Bed and Breakfast",
  "bed and breakfast": "Bed and Breakfast",
  ai: "All Inclusive",
  "all inclusive": "All Inclusive",
  uai: "Ultra All Inclusive",
  ro: "Room Only",
  ep: "Room Only",
  "room only": "Room Only",
  "green tax": "Maldives green tax, already included in your price",
  "maldives green tax": "Maldives green tax, already included in your price",
  "shared return seaplane":
    "Return seaplane transfer to and from the resort, shared with other guests",
  "shared seaplane": "Return seaplane transfer to and from the resort, shared with other guests",
  "return seaplane": "Return seaplane transfer to and from the resort",
  seaplane: "Seaplane transfer to and from the resort",
};

const PERCENT_SC = /^(\d+(?:\.\d+)?)\s*%?\s*sc$/i;
const PERCENT_GST = /^(\d+(?:\.\d+)?)\s*%?\s*gst$/i;
const PERCENT_TGST = /^(\d+(?:\.\d+)?)\s*%?\s*t-?gst$/i;
const KIDS_FB =
  /^kids?\s*0\s*[-–to]+\s*11\s*fb(?:\s+kids?\s+menu)?(?:\s*\(?\s*upto\s*(\d+)\s*\)?)?$/i;
const SC_IN_LINE = /(\d+(?:\.\d+)?)\s*%?\s*sc\b/gi;
const GST_IN_LINE = /(\d+(?:\.\d+)?)\s*%?\s*gst\b/gi;
const BOARD_IN_LINE = /\b(uai|ai|hb|fb|bb|ro|ep)\b/gi;

const BOARD_WORDS: Record<string, string> = {
  uai: "Ultra All Inclusive",
  ai: "All Inclusive",
  hb: "Half Board",
  fb: "Full Board",
  bb: "Bed and Breakfast",
  ro: "Room Only",
  ep: "Room Only",
};

/** Expand one inclusion / board / transfer line for a client-facing PDF. */
export function expandClientWording(text: string): string {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return raw;

  const key = raw.toLowerCase();
  if (EXACT[key]) return EXACT[key]!;

  const sc = raw.match(PERCENT_SC);
  if (sc?.[1]) return `${sc[1]}% service charge, already included in your price`;

  const gst = raw.match(PERCENT_GST);
  if (gst?.[1]) return `${gst[1]}% Goods and Services Tax, already included in your price`;

  const tgst = raw.match(PERCENT_TGST);
  if (tgst?.[1]) return `${tgst[1]}% TGST, already included in your price`;

  const kids = raw.match(KIDS_FB);
  if (kids) {
    return kids[1]
      ? `Up to ${kids[1]} children aged 0–11 have full board from the children's menu`
      : "Children aged 0–11 have full board from the children's menu";
  }

  let out = raw;
  out = out.replace(SC_IN_LINE, (_, n: string) => `${n}% service charge`);
  out = out.replace(GST_IN_LINE, (_, n: string) => `${n}% Goods and Services Tax`);
  out = out.replace(BOARD_IN_LINE, (code) => BOARD_WORDS[code.toLowerCase()] ?? code);

  if (/^green\s*tax\b/i.test(out) && !/already included/i.test(out)) {
    out = "Maldives green tax, already included in your price";
  }
  if (/^shared\s+return\s+seaplane\b/i.test(out)) {
    out = "Return seaplane transfer to and from the resort, shared with other guests";
  }
  if (/^breakfast$/i.test(out)) out = "Daily breakfast";

  return out;
}

/** True when expandClientWording would change this line. */
export function needsClientWording(text: string): boolean {
  const next = expandClientWording(text);
  return next !== text.trim().replace(/\s+/g, " ");
}
