import { cn } from "@/lib/utils/cn";

const SIZES = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
} as const;

type SpinnerProps = {
  size?: keyof typeof SIZES;
  /** `accent` for page/section loading; `current` inherits the parent text color (chips, buttons). */
  tone?: "accent" | "current";
  className?: string;
};

/** Thin ring spinner — light track with a rotating arc. */
export function Spinner({ size = "md", tone = "accent", className }: SpinnerProps) {
  const px = SIZES[size];

  return (
    <svg
      className={cn(
        "studio-spinner shrink-0",
        tone === "accent" && "text-accent-strong",
        className,
      )}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2.5"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
