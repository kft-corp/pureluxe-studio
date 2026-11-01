import { cn } from "@/lib/utils/cn";

import { AgentSparkle } from "./agent-sparkle";

/**
 * Puriva wordmark with sparkles at the top-right of the name
 * (same placement pattern as MakeMyTrip Myra).
 * `xs` = Trip Builder header; `sm` = compact chrome; `md` = empty hero.
 */
export function AgentPurivaMark({
  className,
  sparkleClassName,
  size = "md",
}: {
  className?: string;
  sparkleClassName?: string;
  size?: "xs" | "sm" | "md";
}) {
  const scale =
    size === "xs"
      ? { pad: "pr-3 pt-0.5", text: "text-[1.25rem]", sparkle: "h-2.5 w-2.5" }
      : size === "sm"
        ? { pad: "pr-3.5 pt-1", text: "text-[1.65rem]", sparkle: "h-3 w-3" }
        : {
            pad: "pr-4 pt-1.5",
            text: "text-[2rem] sm:text-[2.15rem]",
            sparkle: "h-3.5 w-3.5",
          };

  return (
    <span className={cn("relative inline-block", scale.pad, className)}>
      <span
        className={cn(
          "bg-linear-to-r from-accent-ink via-accent-strong to-accent bg-clip-text font-agent leading-none font-bold tracking-tight text-transparent",
          scale.text,
        )}
      >
        puriva
      </span>
      <AgentSparkle
        className={cn("absolute top-0 right-0", scale.sparkle, sparkleClassName)}
      />
    </span>
  );
}
