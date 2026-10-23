import Link from "next/link";

import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import { AgentSparkle } from "./agent-sparkle";

const BUTTON_CLASS = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-8",
  studioFocusRing,
);

/** Opens Trip Builder: the agent's mark alone, with the action as its tooltip and accessible name. */
export function TripBuilderButton({
  href,
  label,
  className,
}: {
  /** Omit while the action isn't available yet; the button shows disabled. */
  href?: string;
  label: string;
  className?: string;
}) {
  const icon = <AgentSparkle />;
  if (!href) {
    return (
      <button type="button" disabled aria-label={label} title={label} className={cn(BUTTON_CLASS, className)}>
        {icon}
      </button>
    );
  }
  return (
    <Link href={href} aria-label={label} title={label} className={cn(BUTTON_CLASS, className)}>
      {icon}
    </Link>
  );
}
