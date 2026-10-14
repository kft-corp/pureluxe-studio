"use client";

import { StudioSearchField } from "@/components/ui/studio-search-field";

type BookingSearchProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function BookingSearch({
  value,
  onChange,
  className,
}: BookingSearchProps) {
  return (
    <StudioSearchField
      value={value}
      onChange={onChange}
      placeholder="Search by client, title, hotel, city, or confirmation ref"
      aria-label="Search bookings by client, title, hotel, city, or confirmation ref"
      className={className}
    />
  );
}
