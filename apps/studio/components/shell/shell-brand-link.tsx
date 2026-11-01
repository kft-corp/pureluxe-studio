import Image from "next/image";
import Link from "next/link";

import { studioFocusRing } from "@/components/ui";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

/** Same mark as the browser tab favicon (`app/layout.tsx`). */
const studioMarkPath = "/images/pl_favicon.png";

type ShellBrandLinkProps = {
  /** Mark tile only (collapsed rail). */
  compact?: boolean;
  onNavigate?: () => void;
};

/** Favicon mark and "PureLuxe Studio" wordmark. */
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
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md" aria-hidden>
        <Image
          src={studioMarkPath}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-cover"
          priority
        />
      </span>
      {!compact ? (
        <span className="studio-nav-reveal min-w-0 truncate text-nav-ink-strong">
          <span className="relative inline-block pb-0.5 font-serif text-[15px] leading-none font-semibold tracking-[0.01em] after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-accent after:opacity-80 after:content-['']">
            PureLuxe
          </span>{" "}
          <span className="align-middle font-sans text-[10px] font-semibold tracking-[0.08em] text-nav-label uppercase">
            Studio
          </span>
        </span>
      ) : null}
    </Link>
  );
}
