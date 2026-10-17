"use client";

import { formatVipLabel } from "@/lib/clients";
import { cn } from "@/lib/utils/cn";

type ClientVipBadgeProps = {
  tier: string;
};

/** VIP / VVIP badge — hidden for standard. */
export function ClientVipBadge({ tier }: ClientVipBadgeProps) {
  const label = formatVipLabel(tier);
  const isVip = tier === "vip";
  const isVvip = tier === "vvip";

  if (!isVip && !isVvip) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset",
        isVip && "bg-accent-soft text-accent-ink ring-accent-line",
        isVvip && "bg-avatar-hero text-avatar-hero-ink ring-avatar-hero",
      )}
    >
      {label}
    </span>
  );
}
