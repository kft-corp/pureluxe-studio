import { notFound } from "next/navigation";

import { BookingDetailContent } from "@/components/bookings";
import { ShellModulePage } from "@/components/shell";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getBookingDetail } from "@/lib/bookings";

type BookingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  await requireActiveStudioSession();
  const { id } = await params;

  let detail;
  try {
    detail = await getBookingDetail(id);
  } catch {
    notFound();
  }

  return (
    <ShellModulePage
      module="bookings"
      title="Booking"
      description="Everything your team needs to manage this reservation."
    >
      <BookingDetailContent detail={detail} />
    </ShellModulePage>
  );
}
