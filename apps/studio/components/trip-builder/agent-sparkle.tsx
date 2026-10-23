import { useId } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The agent's mark: Lucide's sparkles shape, filled with a deep-gold → champagne
 * gradient so it reads as a solid brand mark on light surfaces.
 */
export function AgentSparkle({ className }: { className?: string }) {
  const gradientId = useId();
  const fill = `url(#${gradientId})`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 shrink-0", className)}>
      <defs>
        <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent-ink)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--accent-strong)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <path
        fill={fill}
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      />
      <path stroke={fill} strokeWidth={2} strokeLinecap="round" fill="none" d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </svg>
  );
}
