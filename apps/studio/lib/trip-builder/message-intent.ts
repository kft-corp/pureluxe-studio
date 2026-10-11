/**
 * Closed-intent read of one advisor message.
 * Normalize the sentence, score each intent, keep the highest, and fill its slots.
 * A write still happens only from a confirm chip. This step only decides which one.
 */

export type PartyIntent =
  | { intent: "confirm_party" }
  | { intent: "change_lead"; name: string }
  | { intent: "set_role"; name: string; role: "adult" | "child" }
  | { intent: "remove_traveller"; name: string }
  | { intent: "add_traveller"; name: string; child: boolean };

const CLIENT_TOPIC =
  /\b(?:birthdays?|anniversar(?:y|ies)|passports?|preferences?|dietary|diets?|allerg\w*|medications?|health|emails?|phones?|emergency|documents?)\b/i;

const PLACE_TOPIC =
  /\b(?:visas?|seasons?|currenc(?:y|ies)|safety|hotels?|resorts?|villas?|islands?|atolls?|weather|destinations?|countr(?:y|ies)|cities|city|place|best time|kind of place|when (?:should|to|can|do|is the best)|where (?:should|to|can|do)|which (?:country|city|island|hotel)|what(?:'s| is) .+ like|tell me about|visit\w*)\b/i;

const HOTEL_SEARCH =
  /\b(?:search|find|show|list|look up)\b[\s\S]{0,40}\b(?:hotels?|resorts?|villas?)\b|\b(?:hotels?|resorts?|villas?)\b[\s\S]{0,24}\b(?:in|at|for|there|here)\b|\bwhere to stay\b|\bwhich hotels?\b|\bhotel search\b/i;

const CONFIRM_PARTY =
  /^(?:just them|just him|just her|only them|only (?:the )?lead|nobody else|no one else|that'?s everyone|thats everyone|that'?s all|thats all|travelers are set|travellers are set|solo)$/i;

const LEAD_WORD = /\b(?:lead|primary(?:\s+client)?|main\s+client)\b/i;

function normalizeUtterance(message: string): string {
  return message
    .trim()
    .replace(/[?!.,]+$/g, "")
    .replace(
      /^(?:please\s+)?(?:can you|could you|would you|will you|i want to|i'd like to|id like to|let's|lets|kindly)\s+/i,
      "",
    )
    .replace(/^please\s+/i, "")
    .replace(/\s+(?:please|thanks|thank you)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPersonName(value: string): string {
  return value
    .replace(/\b(?:to|on|for|from|this|the|trip|please|client|as)\b.*$/i, "")
    .replace(/[?.!,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function leadName(text: string): string {
  const patterns = [
    /\bfrom\s+.+?\bto\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
    /\bmake\s+([A-Za-z][A-Za-z .'-]{1,60}?)\s+(?:the\s+)?(?:new\s+)?(?:lead|primary)\b/i,
    /\bset\s+([A-Za-z][A-Za-z .'-]{1,60}?)\s+as\s+(?:the\s+)?(?:new\s+)?(?:lead|primary)\b/i,
    /\b(?:promote|switch)\s+([A-Za-z][A-Za-z .'-]{1,60}?)\s+to\s+(?:the\s+)?(?:lead|primary)\b/i,
    /\b([A-Za-z][A-Za-z .'-]{1,60}?)\s+should\s+be\s+(?:the\s+)?(?:new\s+)?(?:lead|primary)\b/i,
    /\b(?:lead|primary(?:\s+client)?|main\s+client|client)\s+(?:should\s+be|to)\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
  ];
  for (const pattern of patterns) {
    const raw = text.match(pattern)?.[1];
    if (!raw) continue;
    const name = raw
      .replace(/\b(?:please|thanks|now|instead)\b.*$/i, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    if (name.length >= 2) return name;
  }
  return "";
}

function isLeadChange(text: string): boolean {
  const changingLead =
    /\b(?:change|switch|update|replace|make|set|promote)\b/i.test(text) && LEAD_WORD.test(text);
  const changingClient =
    /\b(?:change|switch|update|replace)\s+(?:the\s+)?(?:primary\s+)?client\s+to\b/i.test(text);
  const named =
    /\bshould\s+be\s+(?:the\s+)?(?:lead|primary)\b/i.test(text) ||
    /\b(?:the\s+)?lead\s+should\s+be\b/i.test(text);
  return changingLead || changingClient || named;
}

function roleChange(text: string): { name: string; role: "adult" | "child" } | null {
  const match = text.match(
    /\b(?:make|set|mark|change|turn|update)\s+([A-Za-z][A-Za-z .'-]{1,60}?)\s+(?:into\s+|to\s+)?(?:as\s+)?(?:an?\s+)?(child|adult)\b/i,
  );
  if (!match?.[1] || !match[2]) return null;
  const captured = match[1].trim();
  const role = match[2].toLowerCase() === "child" ? "child" : "adult";
  if (/^(?:the\s+)?lead$/i.test(captured)) return { name: "lead", role };
  const name = cleanPersonName(captured);
  if (name.length < 2) return null;
  if (/\b(?:stay|hotel|room|rate)\b/i.test(name)) return null;
  return { name, role };
}

function removeName(text: string): string | null {
  const match = text.match(/^(?:remove|drop)\s+(.+)$/i);
  if (!match?.[1] || /\b(?:stay|leg|city|hotel|rate)\b/i.test(match[1])) return null;
  const name = cleanPersonName(match[1]);
  return name.length >= 2 ? name : null;
}

function addTraveller(text: string): { name: string; child: boolean } | null {
  if (/^(?:add|another|new|extra)\s+(?:a\s+|another\s+)?(?:stay|leg|city)\b/i.test(text)) {
    return null;
  }
  const asChild = text.match(/^(?:add|include)\s+(.+?)\s+as\s+an?\s+child\b/i);
  if (asChild?.[1]) {
    const name = cleanPersonName(asChild[1]);
    if (name.length >= 2) return { name, child: true };
  }
  const add = text.match(/^(?:add|include)\s+(.+)$/i);
  if (!add?.[1]) return null;
  const raw = add[1].replace(/\s+as\s+an?\s+adult\b.*$/i, "");
  if (/\b(?:stay|leg|dates?|hotel|rate|city|rooms?|villas?|options?|quotes?)\b/i.test(raw)) return null;
  const name = cleanPersonName(raw);
  if (name.length < 2) return null;
  return { name, child: false };
}

/**
 * Party write, if this sentence is one.
 * The highest score wins, so "make Ravi a child" is a role change and not an add.
 */
export function classifyPartyIntent(message: string): PartyIntent | null {
  const text = normalizeUtterance(message);
  if (!text) return null;

  const ranked: Array<{ score: number; intent: PartyIntent }> = [];

  if (CONFIRM_PARTY.test(text)) {
    ranked.push({ score: 100, intent: { intent: "confirm_party" } });
  }

  if (isLeadChange(text)) {
    const name = leadName(text);
    const weakName = name.length < 2 || /^(?:the|a|an|lead)$/i.test(name);
    if (!(roleChange(text) && weakName)) {
      ranked.push({ score: 90, intent: { intent: "change_lead", name } });
    }
  }

  const role = roleChange(text);
  if (role) {
    ranked.push({ score: 85, intent: { intent: "set_role", ...role } });
  }

  const removed = removeName(text);
  if (removed) {
    ranked.push({ score: 70, intent: { intent: "remove_traveller", name: removed } });
  }

  const added = addTraveller(text);
  if (added) {
    ranked.push({ score: 60, intent: { intent: "add_traveller", ...added } });
  }

  ranked.sort((left, right) => right.score - left.score);
  return ranked[0]?.intent ?? null;
}

/** Birthday, passport, preferences, and health. These are not destination questions. */
export function isClientQuestion(message: string): boolean {
  return CLIENT_TOPIC.test(message);
}

/**
 * Visa, season, weather, or when to visit.
 * A bare "when" is not enough, so a birthday question stays with the client.
 */
export function isPlaceQuestion(message: string): boolean {
  if (isClientQuestion(message)) return false;
  return PLACE_TOPIC.test(message);
}

/** They asked for hotels on file, not a rate price. */
export function wantsHotelSearch(message: string): boolean {
  if (isClientQuestion(message)) return false;
  return HOTEL_SEARCH.test(message);
}

/**
 * A question to answer. A change such as "search rates" or "sell 4500 USD" is not one.
 * "Can you add Ravi?" is handled as a party change before this is used.
 */
export function isTripQuestion(message: string): boolean {
  if (isClientQuestion(message) || isPlaceQuestion(message)) return true;
  return /^(?:who|what|when|where|why|how|which|is|are|was|were|do|does|did|has|have)\b/i.test(
    message.trim(),
  );
}
