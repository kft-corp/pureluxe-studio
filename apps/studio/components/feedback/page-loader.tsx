import { cn } from "@/lib/utils/cn";

import { MorphingSpinner } from "./morphing-spinner";

const LOADING_LABEL = "Loading";

type PageLoaderProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function PageLoader({ className, size = "md" }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[min(60vh,28rem)] items-center justify-center px-4 py-12",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      <div className="flex flex-col items-center gap-4">
        <MorphingSpinner size={size} />
        <p className="text-sm font-medium text-ink">{LOADING_LABEL}</p>
      </div>
    </div>
  );
}
