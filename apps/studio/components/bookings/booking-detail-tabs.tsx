"use client";

import { PillTabs, type PillTabItem } from "@/components/ui/pill-tabs";

export type BookingDetailTab =
  | "overview"
  | "travellers"
  | "commercial"
  | "policy"
  | "notes"
  | "activity";

type BookingDetailTabsProps = {
  activeTab: BookingDetailTab;
  onTabChange: (tab: BookingDetailTab) => void;
  counts: {
    travellers: number;
    activity: number;
  };
};

function tabLabel(label: string, count?: number): string {
  if (count === undefined || count <= 0) return label;
  return `${label} (${count})`;
}

export function BookingDetailTabs({
  activeTab,
  onTabChange,
  counts,
}: BookingDetailTabsProps) {
  const items: readonly PillTabItem<BookingDetailTab>[] = [
    { id: "overview", label: "Overview" },
    {
      id: "travellers",
      label: tabLabel("Travellers", counts.travellers),
    },
    { id: "commercial", label: "Commercial" },
    { id: "policy", label: "Policy" },
    { id: "notes", label: "Notes" },
    {
      id: "activity",
      label: tabLabel("Activity", counts.activity),
    },
  ];

  return (
    <PillTabs
      items={items}
      value={activeTab}
      onChange={onTabChange}
      ariaLabel="Booking detail sections"
    />
  );
}
