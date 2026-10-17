import { cn } from "@/lib/utils/cn";
import { formatBookingStatus } from "@/lib/bookings";

function statusTone(status: string): string {
  if (status === "confirmed" || status === "completed") {
    return "bg-success-soft text-success-ink ring-success-line";
  }
  if (status === "pending" || status === "on_hold") {
    return "bg-warning-soft text-warning-ink ring-warning-line";
  }
  if (status === "cancelled") {
    return "bg-danger-soft text-danger-ink ring-danger-line";
  }
  return "bg-neutral-soft text-neutral-ink ring-neutral-line";
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
    <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent-ink uppercase ring-1 ring-inset ring-accent-line">
      VIP
    </span>
  );
}
