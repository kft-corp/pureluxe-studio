import { listJourneys } from "@pureluxe/db";
import type { ListJourneysQuery } from "@pureluxe/shared";

export { JOURNEY_DIRECTORY_PAGE_SIZE } from "@pureluxe/shared";

type ListJourneyOptions = ListJourneysQuery & {
  actorMemberId?: string | null;
};

/** Cards for the Trips board. Mine unless the caller asks for the whole team. */
export async function listJourneyDirectory(query: ListJourneyOptions) {
  return listJourneys(query);
}
