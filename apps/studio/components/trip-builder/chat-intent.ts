import {
  classifyPartyIntent,
  isPlaceQuestion,
  isTripQuestion,
  mightNamePlace,
  wantsHotelSearch,
} from "@/lib/trip-builder/message-intent";

export { isPlaceQuestion, isTripQuestion, mightNamePlace, wantsHotelSearch };

const CREATE_TRIP =
  /\b(create|start|begin|open|make|new)\b[\s\S]{0,40}\btrips?\b|\b(new trip|start a trip)\b/i;

const ASSIGN_CLIENT =
  /\b(add|assign|attach)\s+[A-Za-z]/i;

const CONFIRM =
  /^(?:yes|yeah|yep|yup|confirm|ok|okay|do it|go ahead|add them|please do)[.!]*$/i;

const DECLINE = /^(?:no|nope|cancel|stop|don't|do not)[.!]*$/i;

const RATE_SEARCH =
  /\b(search|find|check|get|look up)\b[\s\S]{0,40}\b(rates?|prices?)\b|\b(price|prices|rates?)\b[\s\S]{0,24}\b(hotel|stay)\b/i;

const ADD_STAY =
  /\b(add|another|new|extra)\b[\s\S]{0,40}\b(stay|leg)\b/i;

const NAME_STOP = new Set([
  "a",
  "an",
  "the",
  "client",
  "clients",
  "trip",
  "this",
  "my",
  "our",
  "please",
  "named",
  "called",
]);

/** Advisor asked to start a trip (home chat). */
export function wantsCreateTrip(message: string): boolean {
  return CREATE_TRIP.test(message);
}

/** Advisor asked to put a client on the open trip. */
export function wantsAssignClient(message: string): boolean {
  return ASSIGN_CLIENT.test(message);
}

/**
 * "change the lead from Aarav to Ravi" / "switch the lead to Ravi".
 * Null when this is not a lead change. An empty name means they asked, but named nobody.
 */
export function parseLeadChange(message: string): { name: string } | null {
  const intent = classifyPartyIntent(message);
  if (intent?.intent !== "change_lead") return null;
  return { name: intent.name };
}

/** Named-party commands. Stay and hotel lines are left alone. */
export function parseTravellerCommand(
  message: string,
):
  | { kind: "confirm" }
  | { kind: "remove"; name: string }
  | { kind: "add"; name: string; child: boolean }
  | { kind: "role"; name: string; role: "adult" | "child" }
  | null {
  const intent = classifyPartyIntent(message);
  if (!intent || intent.intent === "change_lead") return null;
  if (intent.intent === "confirm_party") return { kind: "confirm" };
  if (intent.intent === "remove_traveller") return { kind: "remove", name: intent.name };
  if (intent.intent === "set_role") {
    return { kind: "role", name: intent.name, role: intent.role };
  }
  return { kind: "add", name: intent.name, child: intent.child };
}

/** The whole message is a short yes. "Okay, what is the visa?" is a question. */
export function isConfirmReply(message: string): boolean {
  return CONFIRM.test(message.trim());
}

/** The whole message is a short no. */
export function isDeclineReply(message: string): boolean {
  return DECLINE.test(message.trim());
}

/** Advisor asked to price the saved stay. */
export function wantsRateSearch(message: string): boolean {
  return RATE_SEARCH.test(message);
}

const CHANGE_TRIP_DATES =
  /\b(?:change|move|update|edit|set|shift|correct)\b[\s\S]{0,48}\b(?:the\s+|this\s+|whole\s+|trip\s+)?(?:dates?|start(?:\s+date)?|end(?:\s+date)?|window)\b|\b(?:new|different)\s+(?:trip\s+)?dates?\b|\btrip dates?\b/i;

const REMOVE_STAY = /\b(?:remove|delete|drop)\b/i;

/** Hotel, party, or room lines belong to stay planning, not to adding a stay. */
export function looksLikeHotelPlan(message: string): boolean {
  return /\b(?:hotel|property|adults?|children|child|kids?|rooms?)\s*[:\-]/i.test(message);
}

/** Advisor asked to replace the whole-trip window. */
export function wantsChangeTripDates(message: string): boolean {
  return CHANGE_TRIP_DATES.test(message);
}

/**
 * "shift the trip by 2 days", "move everything 3 days later", "push all dates back a day",
 * "bring the trip forward a week". Needs "by" or a direction word, so
 * "move the trip to a week in Bali" is not a shift.
 * Returns signed days (negative = earlier), or null. Without a direction it means later.
 */
export function parseTripShift(message: string): number | null {
  const text = message.toLowerCase();
  if (!/\b(?:shift|move|push|bring|pull|slide|delay)\b/.test(text)) return null;
  if (!/\b(?:trip|everything|all\s+(?:the\s+)?(?:dates|stays)|whole|entire)\b/.test(text)) {
    return null;
  }
  if (!/\b(?:by|later|earlier|sooner|back|forward|delay)\b/.test(text)) return null;
  const match = text.match(/\b(\d{1,3}|a|one)\s+(day|night|week)s?\b/);
  if (!match) return null;
  const count = /^\d/.test(match[1]!) ? Number(match[1]) : 1;
  const days = match[2] === "week" ? count * 7 : count;
  if (days === 0) return null;
  return /\b(?:earlier|sooner|forward)\b/.test(text) ? -days : days;
}

/** Advisor asked to append another stay on this trip. */
export function wantsAddStay(message: string): boolean {
  if (ADD_STAY.test(message)) return true;
  return /^add\s+[A-Za-z]/i.test(message.trim()) && /\d{4}-\d{2}-\d{2}/.test(message);
}

/** Whole-trip start and end. A city in the same message is a stay, not the trip window. */
export function parseTripDates(message: string): {
  checkIn: string;
  checkOut: string;
} | null {
  if (parseAddStay(message)) return null;
  const labeledIn = message.match(
    /(?:^|\n)\s*(?:trip\s+)?(?:start(?:\s+date)?|check[\s-]?in)\s*[:\-]\s*(\d{4}-\d{2}-\d{2})/i,
  );
  const labeledOut = message.match(
    /(?:^|\n)\s*(?:trip\s+)?(?:end(?:\s+date)?|check[\s-]?out)\s*[:\-]\s*(\d{4}-\d{2}-\d{2})/i,
  );
  const dates = [...message.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]!);
  const checkIn = labeledIn?.[1] ?? dates[0];
  const checkOut = labeledOut?.[1] ?? dates[1];
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  return { checkIn, checkOut };
}

/** City plus both dates for a new stay. Hotel is not required. */
export function parseAddStay(message: string): {
  city: string;
  checkIn: string;
  checkOut: string;
} | null {
  const labeled = message.match(
    /(?:^|\n)\s*(?:city|destination)\s*[:\-]\s*(.+)$/im,
  );
  const loose = message.match(
    /\b(?:add|another|new|extra)\s+(?:a\s+|another\s+)?(?:stay|leg)?\s*(?:in|to|for)?\s*([A-Za-z][A-Za-z .'-]{1,48})/i,
  );
  const city = (labeled?.[1] ?? loose?.[1] ?? "")
    .replace(/\b(?:check|from|on|after|before|dates?)\b.*$/i, "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const dates = [...message.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]!);
  const checkIn = dates[0];
  const checkOut = dates[1];
  if (!city || !checkIn || !checkOut || checkOut <= checkIn) return null;
  return { city, checkIn, checkOut };
}

const CITY_STOP = new Set([
  "yes",
  "no",
  "ok",
  "okay",
  "hotel",
  "stay",
  "trip",
  "dates",
  "rates",
  "quote",
  "sell",
  "search",
  "plan",
  "adults",
  "children",
  "rooms",
]);

/** A city with no dates. Used for the first stay, which takes the full trip window. */
export function parseCityOnly(message: string): string | null {
  if (/\d{4}-\d{2}-\d{2}/.test(message)) return null;
  const labeled = message.match(/^(?:city|destination)\s*[:\-]\s*(.+)$/i);
  const bare = message.match(/^([A-Za-z][A-Za-z .'-]{1,48})$/);
  const city = (labeled?.[1] ?? bare?.[1] ?? "")
    .replace(/[?.!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (city.length < 2) return null;
  const words = city.split(/\s+/);
  if (words.length > 4) return null;
  if (words.some((word) => CITY_STOP.has(word.toLowerCase()))) return null;
  return city;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Dates for a stay that is already on the trip.
 * "add Dubai …" stays an add, so a second stay in the same city is possible.
 */
export function parseListedStayEdit(
  message: string,
  stays: { city: string }[],
): { city: string; checkIn: string; checkOut: string } | null {
  if (wantsChangeTripDates(message)) return null;
  if (/^\s*(?:add|another|new|extra)\b/i.test(message.trim())) return null;
  const dates = [...message.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((match) => match[1]!);
  const checkIn = dates[0];
  const checkOut = dates[1];
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  const hit = stays.find((stay) => {
    const city = stay.city.trim();
    if (city.length < 2) return false;
    return new RegExp(`\\b${escapeRegExp(city)}\\b`, "i").test(message);
  });
  if (!hit) return null;
  return { city: hit.city.trim(), checkIn, checkOut };
}

/** "remove Dubai" or "remove this stay". Returns "open" when they mean the stay on screen. */
export function parseRemoveStay(message: string): "open" | string | null {
  if (!REMOVE_STAY.test(message)) return null;
  if (/\b(?:this stay|this leg|open stay|current stay)\b/i.test(message)) return "open";
  const named = message.match(
    /\b(?:remove|delete|drop)\s+(?:the\s+)?(?:stay\s+)?(?:in\s+|to\s+)?([A-Za-z][A-Za-z .'-]{1,48})/i,
  );
  const city = named?.[1]
    ?.replace(/\b(?:stay|leg|from|the|trip|please)\b.*$/i, "")
    .replace(/[?.!,]+$/g, "")
    .trim();
  return city && city.length >= 2 ? city : null;
}

/**
 * Best-effort person name from an intent sentence.
 * "create a trip for Sarah Chen" → "Sarah Chen".
 * Returns null when there is no usable name.
 */
export function clientNameFromMessage(message: string): string | null {
  const patterns = [
    /\b(?:for|about|named|called)\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
    /\b(?:add|assign|use|attach)\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    const cleaned = raw
      .replace(/\b(to|on|for|this|the|trip|please|client)\b.*$/i, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    const words = cleaned.split(/\s+/).filter((word) => !NAME_STOP.has(word.toLowerCase()));
    const name = words.join(" ").trim();
    if (name.length >= 2) return name;
  }

  return null;
}
