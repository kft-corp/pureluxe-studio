import { hasPermission } from "@pureluxe/shared";
import { redirect } from "next/navigation";

import { BookingRegisterForm } from "@/components/bookings";
import { ShellModulePage } from "@/components/shell";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { listRelationshipOwnerOptions } from "@/lib/clients";
import { pageRoutes } from "@/lib/routes";

export default async function NewBookingPage() {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "bookings.write");

  if (!canWrite) {
    redirect(pageRoutes.bookings);
  }

  const ownerOptions = await listRelationshipOwnerOptions().catch(() => []);

  return (
    <ShellModulePage
      module="bookings"
      title="New booking"
      description="Log a supplier confirmation offline. Confirm the booking on the detail page when ready."
    >
      <BookingRegisterForm
        ownerOptions={ownerOptions}
        defaultOwnerId={session.memberId}
      />
    </ShellModulePage>
  );
}
