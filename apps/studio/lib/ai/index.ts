/**
 * Studio adapters for @pureluxe/ai.
 * Map domain data → AI shapes; wire tool handlers (no HTTP).
 */
export { createDeskTools, type DeskActor } from "./create-desk-tools";
export { createHomeAgentTools } from "./create-home-agent-tools";
export { createTripAgentTools } from "./create-trip-agent-tools";
export { toClientBrief } from "./to-client-brief";
export { toClientSearchHit } from "./to-client-search-hit";
export { toTripFacts } from "./to-trip-facts";

export type { TripFacts } from "@pureluxe/ai";
