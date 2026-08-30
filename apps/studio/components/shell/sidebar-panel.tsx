"use client";

import {
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuX,
} from "react-icons/lu";

import type { ShellNavSection } from "@/config/navigation";

import { ShellBrandLink } from "./shell-brand-link";
import { SidebarUserMenu } from "./sidebar-user-menu";
import { SidebarNavLink, isNavItemActive } from "./sidebar-nav-link";

type SidebarPanelProps = {
  user: {
    name: string;
    email: string;
  };
  sections: ShellNavSection[];
  pathname: string;
  unfoldable: boolean;
  showMobileClose: boolean;
  onCloseMobile: () => void;
  onToggleUnfoldable: () => void;
};

export function SidebarPanel({
  user,
  sections,
  pathname,
  unfoldable,
  showMobileClose,
  onCloseMobile,
  onToggleUnfoldable,
}: SidebarPanelProps) {
  const compact = unfoldable && !showMobileClose;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={[
          "flex items-center border-b border-border-dark px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3",
          compact ? "justify-center" : "justify-between gap-2",
        ].join(" ")}
      >
        {!compact ? (
          <ShellBrandLink theme="sidebar" onNavigate={onCloseMobile} />
        ) : (
          <ShellBrandLink theme="sidebar" compact />
        )}

        <div className="flex items-center gap-1">
          {!compact ? (
            <button
              type="button"
              onClick={onToggleUnfoldable}
              className="hidden rounded-md p-1.5 text-on-dark-subtle transition hover:bg-white/5 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/30 md:inline-flex"
              aria-label="Collapse sidebar"
            >
              <LuPanelLeftClose className="h-5 w-5" aria-hidden />
            </button>
          ) : null}

          {showMobileClose ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-on-dark-subtle transition hover:bg-white/5 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/30 md:hidden"
              aria-label="Close navigation menu"
            >
              <LuX className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {compact ? (
        <div className="hidden justify-center border-b border-border-dark py-2 md:flex">
          <button
            type="button"
            onClick={onToggleUnfoldable}
            className="rounded-md p-1.5 text-on-dark-subtle transition hover:bg-white/5 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light/30"
            aria-label="Expand sidebar"
          >
            <LuPanelLeftOpen className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Studio">
        {sections.map((section) => (
          <div key={section.title} className="mt-4 first:mt-0">
            {!compact ? (
              <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.2em] text-on-dark-subtle uppercase">
                {section.title}
              </p>
            ) : (
              <div className="mb-2 px-2">
                <div className="h-px bg-border-dark" />
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarNavLink
                    item={item}
                    active={isNavItemActive(pathname, item.href)}
                    compact={compact}
                    onNavigate={onCloseMobile}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <footer className="border-t border-border-dark p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <SidebarUserMenu
          user={user}
          unfoldable={compact}
          onNavigate={onCloseMobile}
        />
      </footer>
    </div>
  );
}
