"use client";

import { PillTabs, type PillTabItem } from "@/components/ui/pill-tabs";

export type TeamTab = "members" | "roles";

const TABS: readonly PillTabItem<TeamTab>[] = [
  { id: "members", label: "Members" },
  { id: "roles", label: "Role permissions" },
];

type TeamTabsProps = {
  activeTab: TeamTab;
  onTabChange: (tab: TeamTab) => void;
  className?: string;
};

export function TeamTabs({ activeTab, onTabChange, className }: TeamTabsProps) {
  return (
    <PillTabs
      items={TABS}
      value={activeTab}
      onChange={onTabChange}
      ariaLabel="Team sections"
      className={className}
    />
  );
}
