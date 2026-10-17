import { notFound } from "next/navigation";
import { hasPermission } from "@pureluxe/shared";

import { JourneyPage } from "@/components/trips/journey-page";
import { ShellModulePage } from "@/components/shell";
import { pageCopy } from "@/config/page-copy";
import { requireActiveStudioSession } from "@/lib/auth/session-with-permissions";
import { getJourney } from "@/lib/trips";

type TripPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TripPage({ params }: TripPageProps) {
  const session = await requireActiveStudioSession();
  const canWrite = hasPermission(session.permissions, "trips.write");
  const { id } = await params;

  let journey;
  try {
    journey = await getJourney(id);
  } catch {
    notFound();
  }

  return (
    <ShellModulePage module="trips" {...pageCopy.trip}>
      <JourneyPage journey={journey} canWrite={canWrite} />
    </ShellModulePage>
  );
}
