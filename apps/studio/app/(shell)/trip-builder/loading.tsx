import { ShellPage } from "@/components/shell";
import { TripBuilderSkeleton } from "@/components/trip-builder";
import { pageCopy } from "@/config/page-copy";

export default function TripBuilderLoading() {
  return (
    <ShellPage {...pageCopy.tripBuilder} layout="workspace">
      <TripBuilderSkeleton />
    </ShellPage>
  );
}
