import {
  CardSkeleton,
  DetailHeroSkeleton,
  Skeleton,
  SkeletonRegion,
} from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { PageStack } from "@/components/ui";
import { pageCopy } from "@/config/page-copy";

export default function TripLoading() {
  return (
    <ShellPage {...pageCopy.trip}>
      <SkeletonRegion label="Loading trip">
        <PageStack className="min-w-0">
          <Skeleton className="h-4 w-20" />
          <DetailHeroSkeleton media="tile" actions={2} />
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
            <CardSkeleton rows={5} />
            <div className="grid min-w-0 gap-5">
              <CardSkeleton rows={2} />
              <CardSkeleton rows={3} />
            </div>
          </div>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
