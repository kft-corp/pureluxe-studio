import { cn } from "@/lib/utils/cn";
import { formatBookingStatus } from "@/lib/bookings";

function statusTone(status: string): string {
  if (status === "confirmed" || status === "completed") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-600/10";
  }
  if (status === "pending" || status === "on_hold") {
    return "bg-amber-50 text-amber-800 ring-amber-600/10";
  }
  return "bg-stone-100 text-stone-600 ring-stone-500/10";
}

export function BookingStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        statusTone(status),
      )}
    >
      {formatBookingStatus(status)}
    </span>
  );
}

export function BookingVipBadge() {
  return (
    <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink uppercase">
      VIP
    </span>
  );
}
