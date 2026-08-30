"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { LuMenu } from "react-icons/lu";

import {
  filterShellNavigation,
  shellNavigation,
} from "@/config/navigation";

import { ShellBrandLink } from "./shell-brand-link";
import { SidebarPanel } from "./sidebar-panel";
import { useMobileSidebar } from "./use-mobile-sidebar";
import { useSidebarUnfoldable } from "./use-sidebar-unfoldable";

type ShellUser = {
  name: string;
  email: string;
  permissions: readonly string[];
};

type AppShellProps = {
  user: ShellUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const { unfoldable, toggleUnfoldable } = useSidebarUnfoldable();
  const { open: mobileOpen, close: closeMobile, openMenu } = useMobileSidebar();
  const sections = filterShellNavigation(shellNavigation, user.permissions);

  useEffect(() => {
    closeMobile();
  }, [closeMobile, pathname]);

  return (
    <div className="flex h-screen min-h-screen w-full overflow-hidden bg-surface">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-brand-dark/60 backdrop-blur-[1px] md:hidden"
          onClick={closeMobile}
          aria-label="Close navigation menu"
        />
      ) : null}

      <aside
        id="studio-sidebar"
        data-sidebar-unfoldable={unfoldable}
        className={[
          "studio-sidebar z-50 flex h-full flex-col border-r border-border-dark text-on-dark",
          // Mobile drawer — fixed so it does not reserve flex width
          "fixed inset-y-0 left-0 w-[min(18rem,calc(100vw-3rem))] max-w-[85vw]",
          "transition-transform duration-200 ease-out",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full pointer-events-none",
          // Desktop — in-flow sidebar column
          "md:pointer-events-auto md:relative md:inset-auto md:max-w-none md:shrink-0 md:translate-x-0",
          "md:transition-[width] md:duration-200 md:ease-out",
          unfoldable ? "md:w-16" : "md:w-64",
        ].join(" ")}
      >
        <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
          <SidebarPanel
            user={user}
            sections={sections}
            pathname={pathname}
            unfoldable={unfoldable}
            showMobileClose={mobileOpen}
            onCloseMobile={closeMobile}
            onToggleUnfoldable={toggleUnfoldable}
          />
        </div>
      </aside>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <header
          className={[
            "sticky top-0 z-30 flex w-full shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden",
            mobileOpen ? "invisible" : "",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={openMenu}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/20"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="studio-sidebar"
          >
            <LuMenu className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <ShellBrandLink theme="light" />
          </div>
        </header>

        <main className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
