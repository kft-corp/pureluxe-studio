"use client";

import { hasPermission, moduleReadPermission } from "@pureluxe/shared";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LuMenu, LuSearch } from "react-icons/lu";

import { studioFocusRing } from "@/components/ui";
import { buildShellNavigation, liveNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

import { QuickFind } from "./quick-find";
import { ShellBrandLink } from "./shell-brand-link";
import { SidebarPanel } from "./sidebar-panel";
import { useMobileSidebar } from "./use-mobile-sidebar";
import { useSidebarPeek } from "./use-sidebar-peek";
import { useSidebarUnfoldable } from "./use-sidebar-unfoldable";

type ShellUser = {
  name: string;
  email: string;
  roleLabel: string;
  permissions: readonly string[];
};

type AppShellProps = {
  user: ShellUser;
  children: React.ReactNode;
};

const MOBILE_ICON_BUTTON = cn(
  "flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink",
  studioFocusRing,
);

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const { unfoldable, toggleUnfoldable } = useSidebarUnfoldable(pathname);
  const { open: mobileOpen, close: closeMobile, openMenu } = useMobileSidebar();
  const peek = useSidebarPeek(unfoldable && !mobileOpen);
  const { stopPeek } = peek;
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const navigation = useMemo(
    () => buildShellNavigation(user.permissions),
    [user.permissions],
  );
  const pages = useMemo(() => liveNavItems(navigation), [navigation]);
  const canCreateTrip = hasPermission(user.permissions, "trip_builder.write");
  const canSearchClients = hasPermission(user.permissions, moduleReadPermission("clients"));

  useEffect(() => {
    closeMobile();
  }, [closeMobile, pathname]);

  /** Pin or collapse. Collapsing under the mouse must not instantly re-open the hover peek. */
  const toggleSidebar = useCallback(() => {
    stopPeek(!unfoldable);
    toggleUnfoldable();
  }, [stopPeek, toggleUnfoldable, unfoldable]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setQuickFindOpen((open) => !open);
      } else if (key === "b" && window.matchMedia("(min-width: 768px)").matches) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  function openQuickFind() {
    closeMobile();
    setQuickFindOpen(true);
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface md:bg-nav">
      {mobileOpen ? (
        <button
          type="button"
          className="studio-fade-in fixed inset-0 z-40 bg-brand-dark/40 backdrop-blur-[1px] md:hidden"
          onClick={closeMobile}
          aria-label="Close navigation menu"
        />
      ) : null}

      <aside
        id="studio-sidebar"
        data-sidebar-unfoldable={unfoldable}
        className={cn(
          "z-50 flex h-full flex-col border-r border-nav-line bg-nav text-nav-ink md:border-r-0",
          // Mobile drawer — fixed so it does not reserve flex width
          "fixed inset-y-0 left-0 w-[min(18rem,calc(100vw-3rem))] max-w-[85vw] shadow-xl md:shadow-none",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          mobileOpen ? "translate-x-0" : "pointer-events-none -translate-x-full",
          // Desktop — in-flow column; width is the space the page gives up (peek pushes main right).
          "md:pointer-events-auto md:relative md:inset-auto md:max-w-none md:shrink-0 md:translate-x-0",
          "md:transition-[width] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          unfoldable ? (peek.peeking ? "md:w-60" : "md:w-16") : "md:w-60",
        )}
        onPointerEnter={peek.onPointerEnter}
        onPointerLeave={peek.onPointerLeave}
      >
        <div className="flex h-full w-full flex-col bg-nav">
          <SidebarPanel
            user={user}
            navigation={navigation}
            pathname={pathname}
            unfoldable={unfoldable}
            peeking={peek.peeking}
            showMobileClose={mobileOpen}
            canCreateTrip={canCreateTrip}
            onCloseMobile={closeMobile}
            onToggleUnfoldable={toggleSidebar}
            onOpenSearch={openQuickFind}
          />
        </div>
      </aside>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface md:my-2 md:mr-2 md:overflow-hidden md:rounded-xl md:bg-surface-raised md:shadow-sm md:ring-1 md:ring-nav-line">
        <header
          className={cn(
            "sticky top-0 z-30 flex w-full shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden",
            mobileOpen && "invisible",
          )}
        >
          <button
            type="button"
            onClick={openMenu}
            className={MOBILE_ICON_BUTTON}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="studio-sidebar"
          >
            <LuMenu className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <ShellBrandLink />
          </div>

          <button
            type="button"
            onClick={openQuickFind}
            className={MOBILE_ICON_BUTTON}
            aria-label="Search"
          >
            <LuSearch className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-surface md:bg-surface-raised has-data-workspace:overflow-hidden">
          {children}
        </main>
      </div>

      <QuickFind
        open={quickFindOpen}
        onClose={() => setQuickFindOpen(false)}
        pages={pages}
        canCreateTrip={canCreateTrip}
        canSearchClients={canSearchClients}
      />
    </div>
  );
}
