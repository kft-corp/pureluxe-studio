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

/** They asked for hotels on file, not a rate price. */
export function wantsHotelSearch(message: string): boolean {
  if (isClientQuestion(message)) return false;
  return HOTEL_SEARCH.test(message);
}

/** A question to answer. A change such as "search rates" or "sell 4500 USD" is not one. */
export function isTripQuestion(message: string): boolean {
  if (isClientQuestion(message) || isPlaceQuestion(message)) return true;
  return /^(?:who|what|when|where|why|how|which|is|are|was|were|do|does|did|has|have)\b/i.test(
    message.trim(),
  );
}
