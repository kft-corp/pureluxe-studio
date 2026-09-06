"use client";

import { PillTabs, type PillTabItem } from "@/components/ui/pill-tabs";

export type ClientProfileTab =
  | "overview"
  | "preferences"
  | "documents"
  | "health"
  | "household"
  | "activity"
  | "trips";

type ClientProfileTabsProps = {
  activeTab: ClientProfileTab;
  onTabChange: (tab: ClientProfileTab) => void;
  counts: {
    preferences: number;
    documents: number;
    household: number;
    activity: number;
  };
};

function tabLabel(label: string, count?: number): string {
  if (count === undefined || count <= 0) return label;
  return `${label} (${count})`;
}

export function ClientProfileTabs({
  activeTab,
  onTabChange,
  counts,
}: ClientProfileTabsProps) {
  const items: readonly PillTabItem<ClientProfileTab>[] = [
    { id: "overview", label: "Overview" },
    {
      id: "preferences",
      label: tabLabel("Preferences", counts.preferences),
    },
    {
      id: "documents",
      label: tabLabel("Documents", counts.documents),
    },
    { id: "health", label: "Health" },
    {
      id: "household",
      label: tabLabel("Household", counts.household),
    },
    {
      id: "activity",
      label: tabLabel("Activity", counts.activity),
    },
    { id: "trips", label: "Trips" },
  ];

  return (
    <PillTabs
      items={items}
      value={activeTab}
      onChange={onTabChange}
      ariaLabel="Client profile sections"
    />
  );
}
