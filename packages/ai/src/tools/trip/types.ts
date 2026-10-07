import type { TripFacts } from "../../types";

import type { ClientToolHandlers } from "../clients";

/** Host callbacks when a trip is open (client tools + get_trip). */
export type TripToolHandlers = ClientToolHandlers & {
  getTrip: () => Promise<TripFacts>;
};
