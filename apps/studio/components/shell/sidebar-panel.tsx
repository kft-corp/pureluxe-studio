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
  showTitle,
  onNavigate,
}: {
  section: ShellNavSection;
  pathname: string;
  compact: boolean;
  quiet?: boolean;
  /** Only Book travel keeps a section label — curated desk, not CRM inventory. */
  showTitle?: boolean;
  onNavigate: () => void;
}) {
  const { title } = section.group;
  const items = section.items.filter((item) => item.status === "live");
  if (items.length === 0) return null;

  return (
    <div className={cn("mt-6 first:mt-0", quiet && "mt-4 first:mt-0")}>
      {showTitle && title && !compact ? (
        <p className="studio-nav-reveal mb-2.5 truncate px-2.5 text-[11px] font-semibold tracking-[0.1em] text-nav-label uppercase">
          {title}
        </p>
      ) : null}
      <ul className="space-y-1">
        {items.map((item) => (
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

  const footerSections = navigation.footer
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.status === "live"),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "overflow-x-clip px-3.5 pt-[max(1.1rem,env(safe-area-inset-top))] md:pt-5",
          compact ? "flex flex-col items-center gap-2 pb-5" : "pb-5",
        )}
      >
        <div
          className={cn(
            "flex items-start",
            compact ? "flex-col items-center gap-2" : "justify-between gap-2",
          )}
        >
          <ShellBrandLink
            compact={compact}
            showDeskTag={!compact}
            onNavigate={onCloseMobile}
          />

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
              className={cn(ICON_BUTTON, "mt-0.5 hidden h-7 w-7 md:inline-flex", studioFocusRing)}
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
          "space-y-1.5 overflow-x-clip px-3.5 pb-5",
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
              "inline-flex items-center justify-center gap-2 rounded-md border border-accent-line bg-accent-soft text-sm font-semibold text-accent-ink transition hover:border-accent hover:bg-accent/25",
              studioFocusRing,
              compact ? "h-9 w-9" : "h-9 w-full px-3",
            )}
          >
            <LuPlus className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden />
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
            "flex items-center text-[13px] text-nav-muted transition-colors duration-150 hover:text-nav-ink-strong",
            studioFocusRing,
            compact
              ? "h-8 w-8 justify-center rounded-md hover:bg-nav-hover"
              : "w-full gap-2 rounded-md px-2.5 py-1.5",
          )}
        >
          <LuSearch className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          {!compact ? (
            <>
              <span className="studio-nav-reveal flex-1 truncate text-left font-medium">
                Search
              </span>
              <kbd className="studio-nav-reveal font-sans text-[11px] tracking-wide text-nav-muted/90">
                {searchShortcut}
              </kbd>
            </>
          ) : null}
        </button>
      </div>

      <nav
        className={cn(
          "studio-scroll-thin min-h-0 flex-1 overflow-y-auto pb-4",
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
            showTitle={section.group.id === "travel"}
            onNavigate={onCloseMobile}
          />
        ))}
      </nav>

      {footerSections.length > 0 ? (
        <nav
          className={cn(
            "overflow-x-clip border-t border-nav-line/40 pt-3.5 pb-1",
            compact ? "px-2" : "px-3.5",
          )}
          aria-label="Workspace"
        >
          {footerSections.map((section) => (
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
          "border-t border-nav-line/50 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          compact ? "px-2" : "px-3.5",
        )}
      >
        <SidebarUserMenu user={user} unfoldable={compact} onNavigate={onCloseMobile} />
      </footer>
    </div>
  );
}
