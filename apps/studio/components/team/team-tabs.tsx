"use client";

import { cn } from "@/lib/utils/cn";

export type TeamTab = "members" | "roles";

type TeamTabsProps = {
  activeTab: TeamTab;
  onTabChange: (tab: TeamTab) => void;
  className?: string;
};

const TABS: Array<{ id: TeamTab; label: string }> = [
  { id: "members", label: "Members" },
  { id: "roles", label: "Role permissions" },
];

export function TeamTabs({ activeTab, onTabChange, className }: TeamTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Team sections"
      className={cn(
        "inline-flex gap-1 rounded-xl border border-border bg-surface p-1",
        className,
      )}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium ring-1 transition-colors",
              isActive
                ? "bg-surface-raised text-ink shadow-sm ring-border/80"
                : "text-ink-muted ring-transparent hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
