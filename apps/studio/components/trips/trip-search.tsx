"use client";

import { StudioSearchField } from "@/components/ui/studio-search-field";

type TripSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function TripSearch({ value, onChange, className }: TripSearchProps) {
  return (
    <StudioSearchField
      value={value}
      onChange={onChange}
      placeholder="Search by client, title, or city"
      aria-label="Search trips by client, title, or city"
      className={className}
    />
  );
}
