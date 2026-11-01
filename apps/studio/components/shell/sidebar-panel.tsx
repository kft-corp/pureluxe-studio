"use client";

import Link from "next/link";
import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPin,
  LuPlus,
  LuSearch,
  LuX,
} from "react-icons/lu";

import { studioFocusRing } from "@/components/ui";
import type { ShellNavigation, ShellNavSection } from "@/config/navigation";
import { sidebarCopy } from "@/config/page-copy";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { ShellBrandLink } from "./shell-brand-link";
import { SidebarUserMenu } from "./sidebar-user-menu";
import { SidebarNavLink, isNavItemActive } from "./sidebar-nav-link";
import { useShortcutLabel } from "./use-shortcut-label";

type SidebarPanelProps = {
  user: {
    name: string;
    email: string;
    roleLabel: string;
  };
  navigation: ShellNavigation;
  pathname: string;
  unfoldable: boolean;
  /** Collapsed sidebar shown temporarily on hover. */
  peeking: boolean;
  showMobileClose: boolean;
  canCreateTrip: boolean;
  onCloseMobile: () => void;
  onToggleUnfoldable: () => void;
  onOpenSearch: () => void;
};

const ICON_BUTTON =
  "inline-flex items-center justify-center rounded-md text-nav-icon transition hover:bg-nav-hover hover:text-nav-ink-strong";

function NavGroup({
  section,
  pathname,
  compact,
  quiet,
  onNavigate,
}: {
  section: ShellNavSection;
  pathname: string;
  compact: boolean;
  quiet?: boolean;
  onNavigate: () => void;
}) {
  const { title } = section.group;

  return (
    <div className={cn("mt-6 first:mt-1", quiet && "mt-4 first:mt-1 opacity-90")}>
      {title && !compact ? (
        <p className="studio-nav-reveal mb-1.5 truncate px-2.5 text-[11px] font-semibold tracking-[0.04em] text-nav-label">
          {title}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.id}>
            <SidebarNavLink
              item={item}
              active={isNavItemActive(pathname, item.href)}
              compact={compact}
              quiet={quiet || item.group === "core" || item.group === "bottom"}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SidebarPanel({
  user,
  navigation,
  pathname,
  unfoldable,
  peeking,
  showMobileClose,
  canCreateTrip,
  onCloseMobile,
  onToggleUnfoldable,
  onOpenSearch,
}: SidebarPanelProps) {
  const compact = unfoldable && !peeking && !showMobileClose;
  const searchShortcut = useShortcutLabel("K");
  const railShortcut = useShortcutLabel("B");
  const railLabel = `${
    compact ? "Expand sidebar" : peeking ? "Keep sidebar open" : "Collapse sidebar"
  } (${railShortcut})`;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "overflow-x-clip px-3.5 pt-[max(1rem,env(safe-area-inset-top))] md:pt-4",
          compact ? "flex flex-col items-center gap-2 pb-3" : "pb-3",
        )}
      >
        <div
          className={cn(
            "flex items-center",
            compact ? "flex-col gap-2" : "justify-between gap-2",
          )}
        >
          <ShellBrandLink compact={compact} onNavigate={onCloseMobile} />

          {showMobileClose ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className={cn(ICON_BUTTON, "min-h-11 min-w-11 md:hidden", studioFocusRing)}
              aria-label="Close navigation menu"
            >
              <LuX className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleUnfoldable}
              className={cn(ICON_BUTTON, "hidden h-7 w-7 md:inline-flex", studioFocusRing)}
              aria-label={railLabel}
              aria-keyshortcuts="Control+B Meta+B"
              title={railLabel}
            >
              {compact ? (
                <LuPanelLeftOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              ) : peeking ? (
                <LuPin className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              ) : (
                <LuPanelLeftClose className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "space-y-2.5 overflow-x-clip px-3.5 pb-3",
          compact && "flex flex-col items-center",
        )}
      >
        {canCreateTrip ? (
          <Link
            href={pageRoutes.tripBuilder}
            onClick={onCloseMobile}
            aria-label={sidebarCopy.newTrip}
            title={sidebarCopy.newTrip}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md bg-accent text-[13px] font-semibold text-ink shadow-sm transition hover:bg-accent-hover",
              studioFocusRing,
              compact ? "h-8 w-8" : "h-9 w-full px-3",
            )}
          >
            <LuPlus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {!compact ? (
              <span className="studio-nav-reveal truncate">{sidebarCopy.newTrip}</span>
            ) : null}
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={`Search (${searchShortcut})`}
          title={compact ? `Search (${searchShortcut})` : undefined}
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "flex items-center rounded-md text-[13px] tracking-[0.01em] text-nav-ink transition-colors duration-150",
            "bg-white/75 ring-1 ring-nav-line ring-inset hover:bg-white hover:text-nav-ink-strong",
            studioFocusRing,
            compact ? "h-8 w-8 justify-center" : "h-9 w-full gap-2 px-3",
          )}
        >
          <LuSearch className="h-4 w-4 shrink-0 text-nav-icon" strokeWidth={1.75} aria-hidden />
          {!compact ? (
            <>
              <span className="studio-nav-reveal flex-1 truncate text-left font-medium">
                Search…
              </span>
              <kbd className="studio-nav-reveal font-sans text-[11px] text-nav-muted">
                {searchShortcut}
              </kbd>
            </>
          ) : null}
        </button>
      </div>

      <nav
        className={cn(
          "studio-scroll-thin min-h-0 flex-1 overflow-y-auto pb-3",
          compact ? "px-2" : "px-3.5",
        )}
        aria-label="Studio"
      >
        {navigation.main.map((section) => (
          <NavGroup
            key={section.group.id}
            section={section}
            pathname={pathname}
            compact={compact}
            onNavigate={onCloseMobile}
          />
        ))}
      </nav>

      {navigation.footer.length > 0 ? (
        <nav
          className={cn("overflow-x-clip pb-1", compact ? "px-2" : "px-3.5")}
          aria-label="Workspace"
        >
          {navigation.footer.map((section) => (
            <NavGroup
              key={section.group.id}
              section={section}
              pathname={pathname}
              compact={compact}
              quiet
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>
      ) : null}

      <footer
        className={cn(
          "border-t border-nav-line/70 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          compact ? "px-2" : "px-3.5",
        )}
      >
        <SidebarUserMenu user={user} unfoldable={compact} onNavigate={onCloseMobile} />
      </footer>
    </div>
  );
}
