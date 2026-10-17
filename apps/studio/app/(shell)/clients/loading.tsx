import { ClientsTableSkeleton } from "@/components/clients";
import { SkeletonRegion, ToolbarSkeleton } from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { ContentSection, PageStack } from "@/components/ui";
import { listSectionCopy, pageCopy } from "@/config/page-copy";

export default function ClientsLoading() {
  return (
    <ShellPage {...pageCopy.clients}>
      <SkeletonRegion label="Loading clients">
        <PageStack>
          <ToolbarSkeleton />
          <ContentSection {...listSectionCopy.clients}>
            <ClientsTableSkeleton />
          </ContentSection>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
