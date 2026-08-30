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

export type ShellNavItem = {
  label: string;
  href: string;
  icon: IconType;
  /** Module read permission required to show this nav item. */
  permission: PermissionSlug;
};

export type ShellNavSection = {
  title: string;
  items: ShellNavItem[];
};

export const shellNavigation: ShellNavSection[] = [
  {
    title: "Operations",
    items: [
      {
        label: "Home",
        href: pageRoutes.home,
        icon: LuHouse,
        permission: moduleReadPermission("home"),
      },
      {
        label: "Trip Builder",
        href: pageRoutes.tripBuilder,
        icon: LuCompass,
        permission: moduleReadPermission("trip_builder"),
      },
      {
        label: "Bookings",
        href: pageRoutes.bookings,
        icon: LuCalendarCheck,
        permission: moduleReadPermission("bookings"),
      },
      {
        label: "Clients",
        href: pageRoutes.clients,
        icon: LuUsers,
        permission: moduleReadPermission("clients"),
      },
      {
        label: "Trips",
        href: pageRoutes.trips,
        icon: LuLuggage,
        permission: moduleReadPermission("trips"),
      },
      {
        label: "Trainer",
        href: pageRoutes.trainer,
        icon: LuGraduationCap,
        permission: moduleReadPermission("trainer"),
      },
      {
        label: "Tasks",
        href: pageRoutes.tasks,
        icon: LuListTodo,
        permission: moduleReadPermission("tasks"),
      },
    ],
  },
  {
    title: "Commercial",
    items: [
      {
        label: "Commissions",
        href: pageRoutes.commissions,
        icon: LuBadgePercent,
        permission: moduleReadPermission("commissions"),
      },
      {
        label: "Payments",
        href: pageRoutes.payments,
        icon: LuCreditCard,
        permission: moduleReadPermission("payments"),
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Team & Roles",
        href: pageRoutes.team,
        icon: LuUsersRound,
        permission: moduleReadPermission("team"),
      },
      {
        label: "Settings",
        href: pageRoutes.settings,
        icon: LuSettings,
        permission: moduleReadPermission("settings"),
      },
    ],
  },
];

export function filterShellNavigation(
  sections: ShellNavSection[],
  permissions: readonly string[],
): ShellNavSection[] {
  return sections
    .map((section) => ({
      title: section.title,
      items: section.items.filter((item) =>
        hasPermission(permissions, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
