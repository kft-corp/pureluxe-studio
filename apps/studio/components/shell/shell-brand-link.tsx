import Link from "next/link";

import { studioFocusRing } from "@/components/ui";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

type ShellBrandLinkProps = {
  /** Monogram tile only (collapsed rail). */
  compact?: boolean;
  onNavigate?: () => void;
};

/** PureLuxe monogram and "PureLuxe Studio" wordmark. */
export function ShellBrandLink({ compact = false, onNavigate }: ShellBrandLinkProps) {
  return (
    <Link
      href={pageRoutes.home}
      onClick={onNavigate}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90",
        studioFocusRing,
      )}
      title={compact ? "PureLuxe Studio" : undefined}
      aria-label={compact ? "PureLuxe Studio home" : undefined}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-avatar-hero font-serif text-[13px] font-medium tracking-tight text-avatar-hero-ink"
        aria-hidden
      >
        PL
      </span>
      {!compact ? (
        <span className="studio-nav-reveal min-w-0 truncate font-serif text-[15px] leading-tight font-normal tracking-[-0.01em] text-nav-ink-strong">
          PureLuxe Studio
        </span>
      ) : null}
    </Link>
  );
}
