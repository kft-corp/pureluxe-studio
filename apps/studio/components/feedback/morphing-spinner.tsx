import { cn } from "@/lib/utils/cn";

type MorphingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-12 w-12",
} as const;

export function MorphingSpinner({
  size = "md",
  className,
}: MorphingSpinnerProps) {
  return (
    <div
      className={cn("relative", sizeClasses[size], className)}
      aria-hidden
    >
      <div className="morphing-spinner-shape absolute inset-0 bg-brand-dark" />
    </div>
  );
}
