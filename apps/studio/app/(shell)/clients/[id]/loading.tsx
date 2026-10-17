import {
  CardSkeleton,
  DetailHeroSkeleton,
  Skeleton,
  SkeletonRegion,
  TabsSkeleton,
} from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { PageStack } from "@/components/ui";
import { pageCopy } from "@/config/page-copy";

export default function ClientProfileLoading() {
  return (
    <ShellPage {...pageCopy.client}>
      <SkeletonRegion label="Loading client profile">
        <PageStack>
          <Skeleton className="h-4 w-24" />
          <DetailHeroSkeleton media="avatar" actions={3} />
          <TabsSkeleton count={5} />
          <div className="grid gap-5 lg:grid-cols-2">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={4} />
          </div>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
