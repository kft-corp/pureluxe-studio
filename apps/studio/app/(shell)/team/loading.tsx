import {
  CardSkeleton,
  SkeletonRegion,
  ToolbarSkeleton,
} from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { MembersTableSkeleton } from "@/components/team";
import { ContentSection, PageStack } from "@/components/ui";
import { pageCopy } from "@/config/page-copy";
import {
  getMembersSectionDescription,
  getMembersSectionTitle,
} from "@/lib/team/member-filter-utils";

export default function TeamLoading() {
  return (
    <ShellPage {...pageCopy.team}>
      <SkeletonRegion label="Loading team">
        <PageStack>
          <ToolbarSkeleton />
          <ContentSection
            title={getMembersSectionTitle("all")}
            description={getMembersSectionDescription("all", false)}
          >
            <MembersTableSkeleton />
          </ContentSection>
          <CardSkeleton rows={2} />
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
