import { SkeletonRegion, ToolbarSkeleton } from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { TripsTableSkeleton } from "@/components/trips";
import { ContentSection, PageStack } from "@/components/ui";
import { listSectionCopy, pageCopy } from "@/config/page-copy";

export default function TripsLoading() {
  return (
    <ShellPage {...pageCopy.trips}>
      <SkeletonRegion label="Loading trips">
        <PageStack>
          <ToolbarSkeleton />
          <ContentSection {...listSectionCopy.trips}>
            <TripsTableSkeleton />
          </ContentSection>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
