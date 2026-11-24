import { Suspense } from "react";
import { hasPermission } from "@pureluxe/shared";

import { TripsPageContent } from "@/components/trips";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import type { JourneyDirectoryData } from "@/lib/api/trips";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { listRelationshipOwnerOptions } from "@/lib/clients";
import { toURLSearchParams } from "@/lib/directory";
import {
  JOURNEY_DIRECTORY_PAGE_SIZE,
  listJourneyDirectory,
  type TripOwnerFilterOption,
} from "@/lib/trips";
import {
  parseTripDirectoryUrlState,
  tripDirectoryUrlStateToListQuery,
} from "@/lib/trips/trip-directory-query";

const EMPTY_DIRECTORY: JourneyDirectoryData = {
  journeys: [],
  total: 0,
  limit: JOURNEY_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

type TripsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const session = await requireActiveStudioSession();
  const canStartTrip = hasPermission(session.permissions, "trip_builder.write");
  const params = await searchParams;
  const directoryState = parseTripDirectoryUrlState(toURLSearchParams(params));
  const directoryQuery = tripDirectoryUrlStateToListQuery(directoryState);

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
    <ShellModulePage module="trips" {...pageCopy.trips}>
      <Suspense fallback={null}>
        <TripsPageContent
          initialDirectory={initialDirectory}
          ownerOptions={ownerOptions}
          canStartTrip={canStartTrip}
        />
      </Suspense>
    </ShellModulePage>
  );
}
