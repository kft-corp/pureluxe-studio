import {
  DetailListSkeleton,
  Skeleton,
  SkeletonRegion,
} from "@/components/feedback";
import { ShellPage } from "@/components/shell";
import { ContentSection, PageStack, PageToolbar } from "@/components/ui";
import { pageCopy } from "@/config/page-copy";

export default function AccountLoading() {
  return (
    <ShellPage {...pageCopy.account}>
      <SkeletonRegion label="Loading account">
        <PageStack>
          <PageToolbar>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-7 w-48 max-w-full" />
                  <Skeleton className="mt-2.5 h-3.5 w-32" />
                  <Skeleton className="mt-2 h-3.5 w-56 max-w-full" />
                  <div className="mt-3 flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-8 w-full sm:w-28" />
            </div>
          </PageToolbar>
          <ContentSection
            title="Profile details"
            description="Your contact details. Name, designation, and phone can be updated."
          >
            <DetailListSkeleton rows={4} columns={2} />
          </ContentSection>
          <ContentSection title="Account">
            <DetailListSkeleton rows={1} />
          </ContentSection>
        </PageStack>
      </SkeletonRegion>
    </ShellPage>
  );
}
