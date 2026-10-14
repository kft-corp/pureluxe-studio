import { hasPermission, listBookingsQuerySchema } from "@pureluxe/shared";

import { BookingsPageContent } from "@/components/bookings";
import { ShellModulePage } from "@/components/shell";
import type { BookingDirectoryData } from "@/lib/api/bookings";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import {
  BOOKING_DIRECTORY_PAGE_SIZE,
  listBookingDirectory,
  type BookingOwnerFilterOption,
} from "@/lib/bookings";
import { listRelationshipOwnerOptions } from "@/lib/clients";

const EMPTY_DIRECTORY: BookingDirectoryData = {
  bookings: [],
  total: 0,
  limit: BOOKING_DIRECTORY_PAGE_SIZE,
  offset: 0,
};

export default async function BookingsPage() {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "bookings.write");

  let initialDirectory = EMPTY_DIRECTORY;
  let ownerOptions: BookingOwnerFilterOption[] = [];

  const directoryQuery = listBookingsQuerySchema.parse({
    limit: BOOKING_DIRECTORY_PAGE_SIZE,
  });

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
    <ShellModulePage
      module="bookings"
      title="Bookings"
      description="Confirmed inventory — refs, deadlines, and follow-ups."
    >
      <BookingsPageContent
        initialDirectory={initialDirectory}
        ownerOptions={ownerOptions}
        canWrite={canWrite}
      />
    </ShellModulePage>
  );
}
