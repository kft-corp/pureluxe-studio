import { Suspense } from "react";

import { hasPermission } from "@pureluxe/shared";

import { ShellModulePage } from "@/components/shell";
import { TripBuilderPageContent, TripBuilderSkeleton } from "@/components/trip-builder";
import { pageCopy } from "@/config/page-copy";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  getTripDetail,
  listTripBuilderTrips,
  type TripDetail,
  type TripListItem,
} from "@/lib/trip-builder";

type TripBuilderPageProps = {
  searchParams: Promise<{
    trip?: string;
  }>;
};

export default async function TripBuilderPage({
  searchParams,
}: TripBuilderPageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "trip_builder.write");
  const params = await searchParams;

  let initialTrips: TripListItem[] = [];
  let initialDetail: TripDetail | null = null;

  const listResult = await Promise.allSettled([
    listTripBuilderTrips(
      { limit: 20, offset: 0, status: "any" },
      { memberId: session.memberId },
    ),
  ]);

  if (listResult[0].status === "fulfilled") {
    initialTrips = listResult[0].value.trips;
  }

  if (params.trip) {
    try {
      initialDetail = await getTripDetail(params.trip, {
        memberId: session.memberId,
      });
    } catch {
      initialDetail = null;
    }
  }

  return (
    <ShellModulePage module="trip_builder" {...pageCopy.tripBuilder} layout="workspace">
      <Suspense fallback={<TripBuilderSkeleton />}>
        <TripBuilderPageContent
          initialTrips={initialTrips}
          initialDetail={initialDetail}
          canWrite={canWrite}
        />
      </Suspense>
    </ShellModulePage>
  );
}
