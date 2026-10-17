import { cn } from "@/lib/utils/cn";

import { Spinner } from "./spinner";

type PageLoaderProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** What is loading, e.g. "Loading permissions". Shown muted with an ellipsis. */
  label?: string;
};

/** Centered spinner for loads with no predictable layout. Fades in after a short delay. */
export function PageLoader({
  className,
  size = "md",
  label = "Loading",
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "studio-delayed-reveal flex min-h-[min(60vh,28rem)] items-center justify-center px-4 py-12",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size={size} />
        <p className="text-xs font-medium text-ink-muted">{label}…</p>
      </div>
    </div>
  );
}
