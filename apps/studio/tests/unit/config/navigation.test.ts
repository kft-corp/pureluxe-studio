import { describe, expect, it } from "vitest";

import {
  buildShellNavigation,
  liveNavItems,
  navGroups,
  plannedNavItems,
  shellNavItems,
} from "@/config/navigation";

const allPermissions = shellNavItems.map((item) => item.permission);

function ids(items: { id: string }[]) {
  return items.map((item) => item.id);
}

describe("buildShellNavigation", () => {
  it("keeps every item in its category, in group order", () => {
    const navigation = buildShellNavigation(allPermissions);

    expect(navigation.main.map((section) => section.group.id)).toEqual([
      "core",
      "travel",
      "business",
    ]);
    expect(ids(navigation.main[0].items)).toEqual(["home", "tasks"]);
    expect(ids(navigation.main[1].items)).toEqual([
      "trip-builder",
      "trips",
      "clients",
      "bookings",
    ]);
    expect(ids(navigation.main[2].items)).toEqual(["commissions", "payments"]);
    expect(navigation.footer.map((section) => ids(section.items))).toEqual([
      ["settings", "team", "trainer"],
    ]);
  });

  it("lists only live pages for quick find", () => {
    const pages = ids(liveNavItems(buildShellNavigation(allPermissions)));

    expect(pages).toContain("clients");
    expect(pages).not.toContain("tasks");
    expect(pages).not.toContain("settings");
  });

  it("drops groups the person cannot see", () => {
    const clientsOnly = shellNavItems.find((item) => item.id === "clients")!.permission;
    const navigation = buildShellNavigation([clientsOnly]);

    expect(navigation.main).toHaveLength(1);
    expect(ids(navigation.main[0].items)).toEqual(["clients"]);
    expect(navigation.footer).toEqual([]);
  });
});

describe("navigation config", () => {
  it("keeps every item and planned module in a known group with a unique id", () => {
    const groupIds = new Set(navGroups.map((group) => group.id));
    const allIds = [...shellNavItems, ...plannedNavItems].map((item) => item.id);

    for (const item of [...shellNavItems, ...plannedNavItems]) {
      expect(groupIds.has(item.group)).toBe(true);
    }
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
