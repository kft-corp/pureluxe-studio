import {
  CardSkeleton,
  PageHeaderSkeleton,
  SkeletonRegion,
  ToolbarSkeleton,
} from "@/components/feedback";
import { shellPageContainerClass } from "@/components/shell";
import { PageStack } from "@/components/ui";

export default function ShellLoading() {
  return (
    <div className={shellPageContainerClass}>
      <SkeletonRegion label="Loading page">
        <PageHeaderSkeleton />
        <PageStack>
          <ToolbarSkeleton filters={false} />
          <CardSkeleton rows={5} />
        </PageStack>
      </SkeletonRegion>
    </div>
  );
}
