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
        isVip && "bg-amber-50 text-amber-950 ring-amber-700/20",
        isVvip && "bg-stone-800 text-stone-50 ring-stone-800/20",
      )}
    >
      {label}
    </span>
  );
}
