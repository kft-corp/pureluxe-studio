import { hasPermission, listJourneysQuerySchema } from "@pureluxe/shared";

import { TripsPageContent } from "@/components/trips";
import { ShellModulePage } from "@/components/shell";
import type { JourneyDirectoryData } from "@/lib/api/trips";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { JOURNEY_DIRECTORY_PAGE_SIZE, listJourneyDirectory } from "@/lib/trips";
import { listRelationshipOwnerOptions } from "@/lib/clients";
import type { TripOwnerFilterOption } from "@/lib/trips";

const EMPTY_DIRECTORY: JourneyDirectoryData = {
  journeys: [],
  total: 0,
  limit: JOURNEY_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

export default async function TripsPage() {
  const session = await requireActiveStudioSession();
  const canStartTrip = hasPermission(session.permissions, "trip_builder.write");
  const directoryQuery = listJourneysQuerySchema.parse({
    limit: JOURNEY_DIRECTORY_PAGE_SIZE,
  });

  let initialDirectory = EMPTY_DIRECTORY;
  let ownerOptions: TripOwnerFilterOption[] = [];
  const [directoryResult, ownersResult] = await Promise.allSettled([
    listJourneyDirectory({
      ...directoryQuery,
      actorMemberId: session.memberId,
    }),
    listRelationshipOwnerOptions(),
  ]);
  if (directoryResult.status === "fulfilled") {
    initialDirectory = directoryResult.value;
  }
  if (ownersResult.status === "fulfilled") {
    ownerOptions = ownersResult.value.filter((owner) => owner.id !== session.memberId);
  }

  return (
    <ShellModulePage
      module="trips"
      title="Trips"
      description="Who is travelling, when, and whether the trip is still being planned."
    >
      <TripsPageContent
        initialDirectory={initialDirectory}
        ownerOptions={ownerOptions}
        canStartTrip={canStartTrip}
      />
    </ShellModulePage>
  );
}
