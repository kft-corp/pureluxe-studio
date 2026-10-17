import { cn } from "@/lib/utils/cn";

/** One placeholder block. Size and shape come from `className` (h-*, w-*, rounded-*). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("studio-skeleton rounded-md", className)} />;
}

type SkeletonRegionProps = {
  /** Announced to screen readers, e.g. "Loading clients". */
  label: string;
  className?: string;
  children: React.ReactNode;
};

/** Wraps a skeleton layout: announces the load once and fades in after a short delay. */
export function SkeletonRegion({ label, className, children }: SkeletonRegionProps) {
  return (
    <div aria-busy="true" className={cn("studio-delayed-reveal", className)}>
      <span role="status" className="sr-only">
        {label}…
      </span>
      {children}
    </div>
  );
}
