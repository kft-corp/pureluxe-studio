"use client";

import Link from "next/link";

import { studioFocusRing } from "@/components/ui";
import type { ShellNavItem } from "@/config/navigation";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === pageRoutes.home) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarNavLinkProps = {
  item: ShellNavItem;
  active: boolean;
  compact: boolean;
  /** Softer treatment for Home / Tasks / footer ops items. */
  quiet?: boolean;
  onNavigate?: () => void;
};

export function SidebarNavLink({
  item,
  active,
  compact,
  quiet = false,
  onNavigate,
}: SidebarNavLinkProps) {
  const Icon = item.icon;
  const soon = item.status === "soon";
  const tooltip = soon ? `${item.label} · Coming soon` : item.label;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? tooltip : undefined}
      title={compact ? tooltip : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 tracking-[0.01em] transition-colors duration-150",
        quiet ? "text-[14px]" : "text-[15px]",
        studioFocusRing,
        active
          ? "bg-nav-active font-semibold text-nav-ink-strong shadow-sm before:absolute before:top-1 before:bottom-1 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
          : "font-medium text-nav-ink hover:bg-nav-hover hover:text-nav-ink-strong",
        compact && "h-8 w-8 justify-center px-0",
        quiet && !active && "opacity-80",
      )}
    >
      <Icon
        className={cn(
          "shrink-0 transition-colors duration-150",
          quiet ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]",
          active
            ? "text-accent-strong"
            : "text-nav-icon group-hover:text-nav-ink-strong",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      {!compact ? (
        <>
          <span className="studio-nav-reveal min-w-0 flex-1 truncate">
            {item.label}
          </span>
          {soon ? (
            <span className="studio-nav-reveal shrink-0 text-[11px] font-semibold tracking-[0.08em] text-accent-strong uppercase">
              Soon
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}
