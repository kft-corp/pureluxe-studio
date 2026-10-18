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
  onNavigate?: () => void;
};

export function SidebarNavLink({
  item,
  active,
  compact,
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
        "group flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors duration-150 md:min-h-8",
        studioFocusRing,
        active
          ? "bg-nav-active font-medium text-nav-ink-strong shadow-sm ring-1 ring-nav-line"
          : soon
            ? "text-nav-label hover:bg-nav-hover"
            : "text-nav-ink hover:bg-nav-hover hover:text-nav-ink-strong",
        compact && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-150",
          active
            ? "text-nav-ink-strong"
            : soon
              ? "text-nav-muted"
              : "text-nav-icon group-hover:text-nav-ink-strong",
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      {!compact ? (
        <>
          <span className="studio-nav-reveal min-w-0 flex-1 truncate">{item.label}</span>
          {soon ? (
            <span className="studio-nav-reveal shrink-0 text-xs text-nav-muted">soon</span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}
