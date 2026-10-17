import { BookingsTableSkeleton } from "@/components/bookings";
import { SkeletonRegion, ToolbarSkeleton } from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { ContentSection, PageStack } from "@/components/ui";
import { listSectionCopy, pageCopy } from "@/config/page-copy";

export default function BookingsLoading() {
  return (
    <ShellPage {...pageCopy.bookings}>
      <SkeletonRegion label="Loading bookings">
        <PageStack>
          <ToolbarSkeleton />
          <ContentSection {...listSectionCopy.bookings}>
            <BookingsTableSkeleton />
          </ContentSection>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
