import { Suspense } from "react";
import { hasPermission } from "@pureluxe/shared";

import { BookingsPageContent } from "@/components/bookings";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import type { BookingDirectoryData } from "@/lib/api/bookings";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  BOOKING_DIRECTORY_PAGE_SIZE,
  listBookingDirectory,
  type BookingOwnerFilterOption,
} from "@/lib/bookings";
import {
  bookingDirectoryUrlStateToListQuery,
  parseBookingDirectoryUrlState,
} from "@/lib/bookings/booking-directory-query";
import { listRelationshipOwnerOptions } from "@/lib/clients";
import { toURLSearchParams } from "@/lib/directory";

const EMPTY_DIRECTORY: BookingDirectoryData = {
  bookings: [],
  total: 0,
  limit: BOOKING_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

type BookingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "bookings.write");
  const params = await searchParams;
  const directoryState = parseBookingDirectoryUrlState(toURLSearchParams(params));
  const directoryQuery = bookingDirectoryUrlStateToListQuery(directoryState);

  let initialDirectory = EMPTY_DIRECTORY;
  let ownerOptions: BookingOwnerFilterOption[] = [];

  const [directoryResult, ownersResult] = await Promise.allSettled([
    listBookingDirectory({
      ...directoryQuery,
      actorMemberId: session.memberId,
    }),
    listRelationshipOwnerOptions(),
  ]);

  if (directoryResult.status === "fulfilled") {
    initialDirectory = directoryResult.value;
  }

  if (ownersResult.status === "fulfilled") {
    ownerOptions = ownersResult.value.filter(
      (owner) => owner.id !== session.memberId,
    );
  }

  return (
    <ShellModulePage module="bookings" {...pageCopy.bookings}>
      <Suspense fallback={null}>
        <BookingsPageContent
          initialDirectory={initialDirectory}
          ownerOptions={ownerOptions}
          canWrite={canWrite}
        />
      </Suspense>
    </ShellModulePage>
  );
}
