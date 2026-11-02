import Image from "next/image";
import Link from "next/link";

import { studioFocusRing } from "@/components/ui";
import { sidebarCopy } from "@/config/page-copy";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

/** Same mark as the browser tab favicon (`app/layout.tsx`). */
const studioMarkPath = "/images/pl_favicon.png";

type ShellBrandLinkProps = {
  /** Mark tile only (collapsed rail). */
  compact?: boolean;
  /** Atelier subline under the wordmark — sidebar rail only. */
  showDeskTag?: boolean;
  onNavigate?: () => void;
};

/** Favicon mark and "PureLuxe Studio" wordmark. */
export function ShellBrandLink({
  compact = false,
  showDeskTag = false,
  onNavigate,
}: ShellBrandLinkProps) {
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
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md" aria-hidden>
        <Image
          src={studioMarkPath}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 object-cover"
          priority
        />
      </span>
      {!compact ? (
        <span className="studio-nav-reveal min-w-0 truncate">
          <span className="block text-nav-ink-strong">
            <span className="relative inline-block pb-0.5 font-serif text-[1.0625rem] leading-none font-semibold tracking-[0.01em] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-accent after:opacity-80 after:content-['']">
              PureLuxe
            </span>{" "}
            <span className="align-middle font-sans text-[11px] font-semibold tracking-[0.08em] text-nav-label uppercase">
              Studio
            </span>
          </span>
          {showDeskTag ? (
            <span className="mt-1.5 block text-[11px] font-medium tracking-[0.04em] text-nav-muted">
              {sidebarCopy.deskTag}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
