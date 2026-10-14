import type {
  DestinationRoutingPattern,
  DestinationType,
  Layer2Pattern,
} from "@pureluxe/db";

import type { RateSourceCode } from "./source-codes";

export type {
  DestinationRoutingPattern,
  DestinationType,
  Layer2Pattern,
} from "@pureluxe/db";

/** Resolution waterfall: first match wins (Layer 1 → 4). */
export type RoutingLayer = 1 | 2 | 3 | 4;

/** Pattern after a layer is chosen (Layer 2 override or Layer 3 type). */
export type RoutingPattern = DestinationRoutingPattern | Layer2Pattern;

/** What layer/pattern ran — team metadata; strip for Client DTOs later. */
export type RateRoutingMeta = {
  layer: RoutingLayer | null;
  pattern: RoutingPattern | null;
  destination_type: DestinationType | null;
  destination_profile_id: string | null;
  sources_tried: RateSourceCode[];
};
