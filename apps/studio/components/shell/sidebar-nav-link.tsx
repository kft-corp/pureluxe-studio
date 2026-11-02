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
  /** Softer treatment for Home / footer ops items. */
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

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      title={compact ? item.label : undefined}
      className={cn(
        "group relative flex min-h-9 items-center gap-2.5 rounded-md px-2.5 tracking-[0.01em] transition-colors duration-150",
        quiet ? "text-[13px]" : "text-sm",
        studioFocusRing,
        active
          ? "font-semibold text-nav-ink-strong before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
          : "font-medium text-nav-ink hover:text-nav-ink-strong",
        !active && !compact && "hover:bg-transparent",
        !active && compact && "hover:bg-nav-hover/70",
        compact && "h-9 w-9 justify-center gap-0 px-0 before:hidden",
        compact && active && "bg-nav-hover",
        quiet && !active && "text-nav-ink/85",
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3 shrink-0 transition-colors duration-150",
          active
            ? "text-accent-strong"
            : "text-nav-icon/70 group-hover:text-nav-ink-strong",
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      {!compact ? (
        <span className="studio-nav-reveal min-w-0 flex-1 truncate">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}
