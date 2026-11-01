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
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg" aria-hidden>
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
        <span className="studio-nav-reveal min-w-0 truncate text-nav-ink-strong">
          <span className="studio-type-brand relative inline-block pb-0.5 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-accent after:opacity-80 after:content-['']">
            PureLuxe
          </span>{" "}
          <span className="studio-type-eyebrow align-middle uppercase tracking-[0.08em] text-nav-label">
            Studio
          </span>
        </span>
      ) : null}
    </Link>
  );
}
