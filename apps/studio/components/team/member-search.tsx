"use client";

import { StudioSearchField } from "@/components/ui/studio-search-field";

type MemberSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function MemberSearch({
  value,
  onChange,
  placeholder = "Search by name or email",
  className,
}: MemberSearchProps) {
  return (
    <StudioSearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label="Search team members by name or email"
      className={className}
    />
  );
}
