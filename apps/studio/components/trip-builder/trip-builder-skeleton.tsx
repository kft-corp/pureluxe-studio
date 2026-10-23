import { Skeleton, SkeletonRegion } from "@/components/feedback";
import { cn } from "@/lib/utils/cn";

function AgentBubbleSkeleton({ lines }: { lines: string[] }) {
  return (
    <div className="mr-auto flex w-full max-w-[min(100%,42rem)] items-start gap-2 self-start sm:gap-2.5">
      <Skeleton className="mt-4 h-7 w-7 shrink-0 rounded-full sm:mt-5 sm:h-8 sm:w-8" />
      <div className="min-w-0 flex-1">
        <Skeleton className="mb-2 h-3 w-24" />
        {lines.map((width, index) => (
          <Skeleton key={index} className={cn("mt-2 h-3.5 max-w-full", width)} />
        ))}
      </div>
    </div>
  );
}

function YouBubbleSkeleton({ width }: { width: string }) {
  return (
    <div className="ml-auto flex w-full max-w-[min(88%,42rem)] flex-col items-end self-end">
      <Skeleton className="mb-2 h-3 w-10" />
      <Skeleton className={cn("h-11 rounded-[14px] rounded-tr-sm", width)} />
    </div>
  );
}

function ChatBubblesSkeleton() {
  return (
    <div className="flex flex-col gap-6 py-2">
      <AgentBubbleSkeleton lines={["w-full", "w-4/5", "w-3/5"]} />
      <YouBubbleSkeleton width="w-2/3" />
      <AgentBubbleSkeleton lines={["w-11/12", "w-2/3"]} />
    </div>
  );
}

/** Chat history placeholder — agent / you / agent bubbles. */
export function ChatSkeleton() {
  return (
    <SkeletonRegion label="Loading chat">
      <ChatBubblesSkeleton />
    </SkeletonRegion>
  );
}

/** Whole Trip Builder desk — header, chat, composer. */
export function TripBuilderSkeleton() {
  return (
    <SkeletonRegion
      label="Loading Trip Builder"
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface"
    >
      <div className="w-full shrink-0 border-b border-border bg-surface-raised">
        <div className="flex w-full items-center gap-3 px-2 py-2.5 lg:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
            {["w-10", "w-8", "w-10", "w-10", "w-12"].map((width, index) => (
              <div key={index} className="flex shrink-0 items-center gap-1.5">
                <Skeleton className="hidden h-2 w-2 rounded-full lg:block" />
                <Skeleton className={cn("h-3", width)} />
              </div>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-8 w-8" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised">
        <div className="min-h-0 flex-1 overflow-hidden px-3 pt-3 sm:px-6 sm:pt-4">
          <ChatBubblesSkeleton />
        </div>
        <div className="shrink-0 border-t border-border bg-surface-raised px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-2">
          <Skeleton className="h-11 w-full rounded-lg lg:h-10" />
          <Skeleton className="mt-2 h-3 w-64 max-w-full" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
