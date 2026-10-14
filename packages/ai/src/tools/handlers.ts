import type { ClientToolHandlers } from "./clients";
import type { HistoryToolHandlers } from "./history";
import type { HotelToolHandlers } from "./hotels";

/** Host callbacks for every chat, with or without an open trip. */
export type DeskToolHandlers = ClientToolHandlers &
  HistoryToolHandlers &
  HotelToolHandlers;
