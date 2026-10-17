const CLIENT_TOPIC =
  /\b(?:birthdays?|anniversar(?:y|ies)|passports?|preferences?|dietary|diets?|allerg\w*|medications?|health|emails?|phones?|emergency|documents?)\b/i;

const PLACE_TOPIC =
  /\b(?:visas?|seasons?|currenc(?:y|ies)|safety|hotels?|resorts?|villas?|islands?|atolls?|weather|destinations?|countr(?:y|ies)|cities|city|place|best time|kind of place|when (?:should|to|can|do|is the best)|where (?:should|to|can|do)|which (?:country|city|island|hotel)|what(?:'s| is) .+ like|tell me about|visit\w*)\b/i;

const HOTEL_SEARCH =
  /\b(?:search|find|show|list|look up)\b[\s\S]{0,40}\b(?:hotels?|resorts?|villas?)\b|\b(?:hotels?|resorts?|villas?)\b[\s\S]{0,24}\b(?:in|at|for|there|here)\b|\bwhere to stay\b|\bwhich hotels?\b|\bhotel search\b/i;

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

const NAME_COMMAND =
  /^(?:sell\b|start\b|end\b|yes|no|ok|okay|hotel:|rooms?:|client price|add\b|remove\b|make\b|just them|search rates|lock\b)/i;

/**
 * A short message that may be only a country, city, or hotel name.
 * "Maldives" and "Soneva Fushi" count. A sell price or a date command does not.
 */
export function mightNamePlace(message: string): boolean {
  const text = message.trim();
  if (text.length < 3 || text.length > 60) return false;
  if (isClientQuestion(text) || NAME_COMMAND.test(text)) return false;
  return text.split(/\s+/).length <= 5;
}

const FOLLOW_UP_START =
  /^(?:and|also|what about|how about|same|that|this|those|him|her|it|them)\b/i;

const FOLLOW_UP_WORD =
  /\b(?:that one|this one|the other|the cheaper|the cheapest|the second|the first|same dates|same hotel|same room)\b/i;

/**
 * A short line that continues the last topic.
 * "That one", "the cheaper villa", "same dates", and "and the visa?" count.
 * A yes, a sell price, or "make him a child" does not.
 */
export function isFollowUpFragment(message: string): boolean {
  const text = message.trim();
  if (text.length < 2 || text.length > 80) return false;
  if (isClientQuestion(text) || NAME_COMMAND.test(text)) return false;
  if (/\b(?:add|remove|make|change|set|sell|lock)\b/i.test(text)) return false;
  if (FOLLOW_UP_START.test(text)) return true;
  return FOLLOW_UP_WORD.test(text);
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
