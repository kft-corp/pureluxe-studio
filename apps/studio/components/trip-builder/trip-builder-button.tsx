import Link from "next/link";
import { LuSparkles } from "react-icons/lu";

import { studioFocusRing } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const BUTTON_CLASS = cn(
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-avatar-hero text-avatar-hero-ink shadow-sm ring-1 ring-inset ring-accent/40 transition-colors hover:bg-brand-dark-hover disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:w-8",
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
  const icon = <LuSparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />;
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
