import type { IconType } from "react-icons";
import {
  LuBadgePercent,
  LuCalendarCheck,
  LuListTodo,
  LuCompass,
  LuCreditCard,
  LuGraduationCap,
  LuHouse,
  LuLuggage,
  LuSettings,
  LuUsers,
  LuUsersRound,
} from "react-icons/lu";

import { pageRoutes } from "@/lib/routes";
import {
  hasPermission,
  moduleReadPermission,
  type PermissionSlug,
} from "@pureluxe/shared";

export type NavGroupId = "core" | "travel" | "partners" | "business" | "bottom";

export type ShellNavGroup = {
  id: NavGroupId;
  /** Category label. Omit for the untitled top group. */
  title?: string;
  /** `footer` groups are pinned above the user row; `main` groups scroll. */
  placement: "main" | "footer";
};

/**
 * Fixed order of sidebar groups. New modules join one of these — never a new ad-hoc list.
 * A group only appears once it has an item; keep at least two items per titled group.
 */
export const navGroups: readonly ShellNavGroup[] = [
  { id: "core", placement: "main" },
  { id: "travel", title: "Travel", placement: "main" },
  { id: "partners", title: "Partners", placement: "main" },
  { id: "business", title: "Business", placement: "main" },
  { id: "bottom", placement: "footer" },
];

/** `live` opens a built page; `soon` shows muted with a quiet "soon" label in its group. */
export type NavStatus = "live" | "soon";

export type ShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconType;
  /** Module read permission required to show this item. */
  permission: PermissionSlug;
  group: NavGroupId;
  status: NavStatus;
  /** Position inside its group. */
  order: number;
};

export const shellNavItems: readonly ShellNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: pageRoutes.home,
    icon: LuHouse,
    permission: moduleReadPermission("home"),
    group: "core",
    status: "live",
    order: 1,
  },
  {
    id: "tasks",
    label: "Tasks",
    href: pageRoutes.tasks,
    icon: LuListTodo,
    permission: moduleReadPermission("tasks"),
    group: "core",
    status: "soon",
    order: 2,
  },
  {
    id: "trip-builder",
    label: "Trip Builder",
    href: pageRoutes.tripBuilder,
    icon: LuCompass,
    permission: moduleReadPermission("trip_builder"),
    group: "travel",
    status: "live",
    order: 1,
  },
  {
    id: "trips",
    label: "Trips",
    href: pageRoutes.trips,
    icon: LuLuggage,
    permission: moduleReadPermission("trips"),
    group: "travel",
    status: "live",
    order: 2,
  },
  {
    id: "clients",
    label: "Clients",
    href: pageRoutes.clients,
    icon: LuUsers,
    permission: moduleReadPermission("clients"),
    group: "travel",
    status: "live",
    order: 3,
  },
  {
    id: "bookings",
    label: "Bookings",
    href: pageRoutes.bookings,
    icon: LuCalendarCheck,
    permission: moduleReadPermission("bookings"),
    group: "travel",
    status: "live",
    order: 4,
  },
  {
    id: "payments",
    label: "Payments",
    href: pageRoutes.payments,
    icon: LuCreditCard,
    permission: moduleReadPermission("payments"),
    group: "business",
    status: "soon",
    order: 2,
  },
  {
    id: "commissions",
    label: "Commissions",
    href: pageRoutes.commissions,
    icon: LuBadgePercent,
    permission: moduleReadPermission("commissions"),
    group: "business",
    status: "soon",
    order: 1,
  },
  {
    id: "trainer",
    label: "Help & training",
    href: pageRoutes.trainer,
    icon: LuGraduationCap,
    permission: moduleReadPermission("trainer"),
    group: "bottom",
    status: "soon",
    order: 3,
  },
  {
    // Moves inside Settings as a sub-page once Settings is live.
    id: "team",
    label: "Team & Roles",
    href: pageRoutes.team,
    icon: LuUsersRound,
    permission: moduleReadPermission("team"),
    group: "bottom",
    status: "live",
    order: 2,
  },
  {
    id: "settings",
    label: "Settings",
    href: pageRoutes.settings,
    icon: LuSettings,
    permission: moduleReadPermission("settings"),
    group: "bottom",
    status: "soon",
    order: 1,
  },
];

export type PlannedNavItem = {
  id: string;
  label: string;
  group: NavGroupId;
  note: string;
};

/**
 * Reserved homes for modules that have no route yet. When one is built, add it to
 * `shellNavItems` with the same id and group so the sidebar layout never changes.
 * Admin pages (Branding, Integrations, Billing) live inside Settings, not the sidebar.
 */
export const plannedNavItems: readonly PlannedNavItem[] = [
  { id: "proposals", label: "Proposals", group: "travel", note: "Quotes and itineraries sent to guests" },
  { id: "documents", label: "Documents", group: "travel", note: "Vouchers, passports, tickets" },
  { id: "travel-calendar", label: "Travel calendar", group: "travel", note: "Arrivals, departures, check-ins" },
  { id: "suppliers", label: "Hotels & suppliers", group: "partners", note: "Hotels, DMCs, and partner contacts" },
  { id: "rates", label: "Rates & contracts", group: "partners", note: "Contracted rates and allotments" },
  { id: "invoices", label: "Invoices", group: "business", note: "Client invoices and receipts" },
  { id: "reports", label: "Reports", group: "business", note: "Sales and margin reporting" },
];

export type ShellNavSection = {
  group: ShellNavGroup;
  items: ShellNavItem[];
};

export type ShellNavigation = {
  main: ShellNavSection[];
  footer: ShellNavSection[];
};

/** Sidebar model for one person: their permitted items (live and soon), grouped and ordered. */
export function buildShellNavigation(permissions: readonly string[]): ShellNavigation {
  const visible = shellNavItems
    .filter((item) => hasPermission(permissions, item.permission))
    .sort((left, right) => left.order - right.order);

  function sections(placement: ShellNavGroup["placement"]): ShellNavSection[] {
    return navGroups
      .filter((group) => group.placement === placement)
      .map((group) => ({
        group,
        items: visible.filter((item) => item.group === group.id),
      }))
      .filter((section) => section.items.length > 0);
  }

  return {
    main: sections("main"),
    footer: sections("footer"),
  };
}

/** Every live page a person can open — used by quick find. */
export function liveNavItems(navigation: ShellNavigation): ShellNavItem[] {
  return [...navigation.main, ...navigation.footer]
    .flatMap((section) => section.items)
    .filter((item) => item.status === "live");
}
