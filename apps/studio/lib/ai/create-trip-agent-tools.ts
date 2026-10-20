import type { PlaceNotes, TripAgentHandlers } from "@pureluxe/ai";

import { readRateSnapshot } from "@/lib/rates/rate-search-store";
import {
  answerAtlasStay,
  getTripDetail,
  getTripReadiness,
  type AtlasHotelChoice,
} from "@/lib/trip-builder";

import type { DeskActor } from "./create-desk-tools";
import { createTripTools } from "./create-trip-tools";
import { toTripFacts } from "./to-trip-facts";

type Options = DeskActor & { tripId: string };

const CONTRACTED: Record<AtlasHotelChoice["contractStatus"], boolean | null> = {
  contracted: true,
  not_yet_contracted: false,
  unknown: null,
};

/**
 * Handlers for the trip agent (v2): today's read tools, plus Atlas notes and the
 * last rate search, which v1 attached to every prompt by text patterns.
 * The trip id comes from the server, never from the model.
 */
export function createTripAgentTools(options: Options): TripAgentHandlers {
  const actor = { memberId: options.memberId };

  return {
    ...createTripTools(options),

    async getTrip() {
      const detail = await getTripDetail(options.tripId, actor);
      return toTripFacts(detail, await getTripReadiness(options.tripId, actor, detail));
    },

    async getPlaceNotes({ query, cityHint }): Promise<PlaceNotes> {
      const atlas = await answerAtlasStay({ question: query, cityHint: cityHint ?? null });
      return {
        matched: atlas.matched,
        notes: atlas.matched ? atlas.answer : null,
        hotels: atlas.hotels.map((hotel) => ({
          name: hotel.name,
          city: hotel.city,
          contracted: CONTRACTED[hotel.contractStatus],
        })),
      };
    },

    getRateSnapshot: () => readRateSnapshot(options.tripId),
  };
}
