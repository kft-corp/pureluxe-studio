/**
 * Studio adapters for @pureluxe/ai.
 * Map domain data → AI shapes; wire tool handlers (no HTTP).
 */
export { createPreTripTools } from "./create-pre-trip-tools";
export { createTripTools } from "./create-trip-tools";
export { toClientBrief } from "./to-client-brief";
export { toClientSearchHit } from "./to-client-search-hit";
export { toTripFacts } from "./to-trip-facts";

export {
  streamTripTurn,
  type TripFacts,
  type TripToolHandlers,
} from "@pureluxe/ai";
