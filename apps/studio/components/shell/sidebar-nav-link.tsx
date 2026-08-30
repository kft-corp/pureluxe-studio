"use client";

import Link from "next/link";

import type { ShellNavItem } from "@/config/navigation";
import { pageRoutes } from "@/lib/routes";

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

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        "group flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 text-sm transition md:min-h-0 md:py-2",
        active
          ? "bg-brand-light text-brand-dark"
          : "text-on-dark-muted hover:bg-white/5 hover:text-on-dark",
        compact ? "justify-center px-2" : "",
      ].join(" ")}
      title={compact ? item.label : undefined}
    >
      <Icon
        className={[
          "h-[18px] w-[18px] shrink-0",
          active
            ? "text-brand-dark"
            : "text-on-dark-subtle group-hover:text-on-dark",
        ].join(" ")}
        aria-hidden
      />
      {!compact ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}
