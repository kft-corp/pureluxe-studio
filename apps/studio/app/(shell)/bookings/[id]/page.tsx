import { notFound } from "next/navigation";
import { hasPermission } from "@pureluxe/shared";

import { BookingDetailContent } from "@/components/bookings";
import { ShellModulePage } from "@/components/shell";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getBookingDetail } from "@/lib/bookings";
import { listRelationshipOwnerOptions } from "@/lib/clients";

type BookingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "bookings.write");
  const { id } = await params;

  let detail;
  try {
    detail = await getBookingDetail(id);
  } catch {
    notFound();
  }

  const ownerOptions = canWrite
    ? await listRelationshipOwnerOptions().catch(() => [])
    : [];

  return (
    <ShellModulePage
      module="bookings"
      title="Booking"
      description="Everything your team needs to manage this reservation."
    >
      <BookingDetailContent
        initialDetail={detail}
        canWrite={canWrite}
        ownerOptions={ownerOptions}
      />
    </ShellModulePage>
  );
}
