"use client";

import type { ClientQuickFilter } from "@pureluxe/shared";

import { studioChipClass } from "@/components/ui";

/** Quick chips — My clients is always last. */
const QUICK_CHIPS: Array<{ id: ClientQuickFilter; label: string }> = [
  { id: "has_family", label: "Has family" },
  { id: "missing_contact", label: "Missing contact" },
  { id: "mine", label: "My clients" },
];

type ClientQuickChipsProps = {
  value: ClientQuickFilter[];
  onChange: (value: ClientQuickFilter[]) => void;
};

export function ClientQuickChips({ value, onChange }: ClientQuickChipsProps) {
  const selected = new Set(value);

  function toggle(filterId: ClientQuickFilter) {
    if (selected.has(filterId)) {
      onChange(value.filter((id) => id !== filterId));
      return;
    }
    onChange([...value, filterId]);
  }

  return (
    <div
      role="group"
      aria-label="Quick filters"
      className="inline-flex max-w-full flex-wrap gap-1.5"
    >
      {QUICK_CHIPS.map((filter) => {
        const isActive = selected.has(filter.id);

        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => toggle(filter.id)}
            className={studioChipClass(isActive)}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
