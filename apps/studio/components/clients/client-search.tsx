"use client";

import { StudioSearchField } from "@/components/ui/studio-search-field";

type ClientSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function ClientSearch({
  value,
  onChange,
  placeholder = "Search by name, email, or phone",
  className,
}: ClientSearchProps) {
  return (
    <StudioSearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label="Search clients by name, email, or phone"
      className={className}
    />
  );
}
