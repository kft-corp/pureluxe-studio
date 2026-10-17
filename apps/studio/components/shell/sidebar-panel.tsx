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
  onNavigate,
}: {
  section: ShellNavSection;
  pathname: string;
  compact: boolean;
  onNavigate: () => void;
}) {
  const { title } = section.group;

  return (
    <div className="mt-5 first:mt-0">
      {title ? (
        compact ? (
          <div className="mx-2 mb-2 h-px bg-nav-line" aria-hidden />
        ) : (
          <p className="studio-nav-reveal mb-1.5 truncate px-2.5 text-[13px] text-nav-label">
            {title}
          </p>
        )
      ) : null}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
          <li key={item.id}>
            <SidebarNavLink
              item={item}
              active={isNavItemActive(pathname, item.href)}
              compact={compact}
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
          "flex items-center overflow-x-clip px-3 pt-[max(0.875rem,env(safe-area-inset-top))] pb-4 md:pt-3.5",
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

      <div
        className={cn(
          "space-y-1 overflow-x-clip px-3 pb-5",
          compact && "flex flex-col items-center",
        )}
      >
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={`Search (${searchShortcut})`}
          title={compact ? `Search (${searchShortcut})` : undefined}
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "flex items-center rounded-lg bg-nav-active/70 text-[15px] font-[450] text-nav-label ring-1 ring-nav-line transition-colors duration-150 ring-inset hover:bg-nav-active hover:text-nav-ink",
            studioFocusRing,
            compact ? "h-9 w-9 justify-center" : "h-9 w-full gap-3 px-2.5",
          )}
        >
          <LuSearch className="h-4 w-4 shrink-0 text-nav-icon" strokeWidth={1.5} aria-hidden />
          {!compact ? (
            <>
              <span className="studio-nav-reveal flex-1 truncate text-left">Search…</span>
              <kbd className="studio-nav-reveal font-sans text-xs text-nav-muted">
                {searchShortcut}
              </kbd>
            </>
          ) : null}
        </button>

        {canCreateTrip ? (
          <Link
            href={pageRoutes.tripBuilder}
            onClick={onCloseMobile}
            aria-label={compact ? "New trip" : undefined}
            title={compact ? "New trip" : undefined}
            className={cn(
              "group flex min-h-11 items-center rounded-lg text-[15px] font-[450] text-nav-ink transition-colors duration-150 hover:bg-nav-hover hover:text-nav-ink-strong md:min-h-9",
              studioFocusRing,
              compact ? "w-9 justify-center" : "w-full gap-3 px-2.5",
            )}
          >
            <LuPlus
              className="h-4 w-4 shrink-0 text-nav-icon transition-colors duration-150 group-hover:text-nav-ink-strong"
              strokeWidth={1.5}
              aria-hidden
            />
            {!compact ? <span className="studio-nav-reveal truncate">New trip</span> : null}
          </Link>
        ) : null}
      </div>

      <nav
        className={cn(
          "studio-scroll-thin min-h-0 flex-1 overflow-y-auto pb-4",
          compact ? "px-2" : "px-3",
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
          className={cn("overflow-x-clip pb-2", compact ? "px-2" : "px-3")}
          aria-label="Workspace"
        >
          {navigation.footer.map((section) => (
            <NavGroup
              key={section.group.id}
              section={section}
              pathname={pathname}
              compact={compact}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>
      ) : null}

      <footer
        className={cn(
          "border-t border-nav-line pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]",
          compact ? "px-2" : "px-3",
        )}
      >
        <SidebarUserMenu user={user} unfoldable={compact} onNavigate={onCloseMobile} />
      </footer>
    </div>
  );
}
