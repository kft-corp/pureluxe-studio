import type { TripFacts } from "../../types";

import type { DeskToolHandlers } from "../handlers";

/** Host callbacks when a trip is open (desk tools + get_trip). */
export type TripToolHandlers = DeskToolHandlers & {
  getTrip: () => Promise<TripFacts>;
};
