"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripStatus } from "@pureluxe/db";
import type { JourneyStatusAction } from "@pureluxe/shared";
import {
  LuBan,
  LuCheck,
  LuChevronDown,
  LuCircleCheck,
  LuDownload,
  LuEye,
  LuHourglass,
  LuRotateCcw,
  LuSend,
} from "react-icons/lu";

import {
  ConfirmDialog,
  studioButtonClass,
  ToolbarMenu,
  type ToolbarMenuItem,
} from "@/components/ui";
import { TripBuilderButton } from "@/components/trip-builder/trip-builder-button";
import { getJourneyQuoteUrl, setJourneyStatus } from "@/lib/api/trips";
import { showApiError, showSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import { isQuoteWithClient } from "@/lib/trips/trip-status";
import { formatTripStatus } from "@/lib/trips/journey-format";
import { cn } from "@/lib/utils/cn";

type StatusAction = JourneyStatusAction;

const CONFIRM: Record<
  StatusAction,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
  send: {
    title: "Quote sent?",
    description:
      "Marks the quote as delivered. If the plan changes in Trip Builder, the trip goes back to building.",
    confirmLabel: "Quote sent",
  },
  waiting: {
    title: "Waiting for a reply?",
    description:
      "Use when the client has replied and you still need something — a decision, passports, or payment.",
    confirmLabel: "Waiting for reply",
  },
  accept: {
    title: "Client said yes?",
    description:
      "Locks the price and moves to booking. Next: open Trip Builder and tap This is their room for each stay.",
    confirmLabel: "Client said yes",
  },
  reopen: {
    title: "Reopen this quote?",
    description:
      "Use when the plan or price must change before the hotel is booked. If the hotel is already booked, amend in Bookings instead.",
    confirmLabel: "Reopen quote",
  },
  confirm: {
    title: "Trip ready for travel?",
    description:
      "Use when every hotel stay is confirmed in Bookings. You can still record client payment on this page.",
    confirmLabel: "Trip ready for travel",
  },
  cancel: {
    title: "Cancel this trip?",
    description: "The trip leaves the active list. The plan stays in Trip Builder.",
    confirmLabel: "Cancel trip",
    destructive: true,
  },
};

const ICON = "h-3.5 w-3.5";

/** Status steps the trip can take from here. Unavailable steps stay visible with the reason. */
function statusMenuItems(
  status: TripStatus,
  quote: { ready: boolean; file: boolean },
  choose: (action: StatusAction) => void,
  gates: { staysConfirmed: boolean; paymentStatus: string },
): ToolbarMenuItem[] {
  const items: ToolbarMenuItem[] = [];

  const withClient = isQuoteWithClient(status);
  const quoteStage = status === "building" || withClient;
  // Once sent, the PDF only goes stale from the client's own room choice.
  const canMark = status === "building" ? quote.ready : quote.file;
  const noQuote = "Generate a current quote in Trip Builder first";

  if (quoteStage && status !== "quote_sent") {
    items.push({
      key: "send",
      label: "Quote sent",
      icon: <LuSend className={ICON} aria-hidden />,
      hint: canMark ? "PDF delivered, no reply yet" : noQuote,
      disabled: !canMark,
      onClick: () => choose("send"),
    });
  }

  if (quoteStage && status !== "waiting_on_client") {
    items.push({
      key: "waiting",
      label: "Waiting for reply",
      icon: <LuHourglass className={ICON} aria-hidden />,
      hint: canMark ? "They replied; you still need something" : noQuote,
      disabled: !canMark,
      onClick: () => choose("waiting"),
    });
  }

  if (quoteStage) {
    const ready = withClient && quote.file;
    items.push({
      key: "accept",
      label: "Client said yes",
      icon: <LuCheck className={ICON} aria-hidden />,
      hint: ready
        ? "Locks the price — then record their room in Trip Builder"
        : "Mark Quote sent first",
      disabled: !ready,
      onClick: () => choose("accept"),
    });
  }

  if (status === "booking" || status === "confirmed") {
    items.push({
      key: "reopen",
      label: "Reopen quote",
      icon: <LuRotateCcw className={ICON} aria-hidden />,
      hint: "Plan change before hotel booked. If already booked, amend in Bookings",
      onClick: () => choose("reopen"),
    });
  }

  if (status !== "confirmed" && status !== "completed") {
    items.push({
      key: "confirm",
      label: "Trip ready for travel",
      icon: <LuCircleCheck className={ICON} aria-hidden />,
      hint: gates.staysConfirmed
        ? gates.paymentStatus === "not_started"
          ? "Hotels confirmed — you can still record payment after"
          : "Every hotel stay is confirmed in Bookings"
        : "Confirm every hotel stay in Bookings first",
      disabled: !gates.staysConfirmed,
      onClick: () => choose("confirm"),
    });
  }

  items.push({
    key: "cancel",
    label: "Cancel trip",
    icon: <LuBan className={ICON} aria-hidden />,
    hint: "Leaves the active list. The plan stays in Trip Builder",
    danger: true,
    divider: items.length > 0,
    onClick: () => choose("cancel"),
  });

  return items;
}

/** Hero actions: Trip Builder, and one menu for the status steps. */
export function JourneyHeroActions({
  tripId,
  status,
  quoteReady,
  quoteFile,
  canWrite,
  staysConfirmed = false,
  paymentStatus = "not_started",
}: {
  tripId: string;
  status: TripStatus;
  quoteReady: boolean;
  quoteFile: boolean;
  canWrite: boolean;
  staysConfirmed?: boolean;
  paymentStatus?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<StatusAction | null>(null);

  const items =
    canWrite && status !== "cancelled"
      ? statusMenuItems(
          status,
          { ready: quoteReady, file: quoteFile },
          setPending,
          { staysConfirmed, paymentStatus },
        )
      : [];

  const confirmConfig =
    pending === "confirm"
      ? {
          ...CONFIRM.confirm,
          description:
            paymentStatus === "not_started"
              ? `${CONFIRM.confirm.description} Payment is still “not started” — you can record it after.`
              : CONFIRM.confirm.description,
        }
      : pending
        ? CONFIRM[pending]
        : null;

  async function run(action: StatusAction) {
    setBusy(true);
    try {
      const response = await setJourneyStatus(tripId, action);
      showSuccessToast(response.message ?? "Trip updated.");
      setPending(null);
      router.refresh();
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
      <TripBuilderButton href={pageRoutes.tripBuilderTrip(tripId)} label="Open in Trip Builder" />
      <ToolbarMenu
        heading={`${formatTripStatus(status)} · move to`}
        menuClassName="w-72 max-w-[calc(100vw-2rem)]"
        items={items}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            aria-expanded={open}
            aria-haspopup="menu"
            className={cn(studioButtonClass("secondary", "sm"), "w-full justify-center sm:w-auto")}
          >
            Update status
            <LuChevronDown
              className={cn(ICON, "transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
      />

      <ConfirmDialog
        open={pending != null}
        loading={busy}
        config={confirmConfig}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={() => {
          if (pending) void run(pending);
        }}
      />
    </div>
  );
}

/** View and download buttons for the client quote PDF in the Documents list. */
export function JourneyQuoteFileButtons({ tripId }: { tripId: string }) {
  const [busy, setBusy] = useState(false);

  async function openQuote(download: boolean) {
    setBusy(true);
    try {
      const response = await getJourneyQuoteUrl(tripId, download);
      if (download) {
        window.location.assign(response.data.url);
      } else {
        window.open(response.data.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      showApiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void openQuote(false)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-raised text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
        aria-label="View quote PDF"
        title="View"
      >
        <LuEye className={ICON} aria-hidden />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void openQuote(true)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-raised text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
        aria-label="Download quote PDF"
        title="Download"
      >
        <LuDownload className={ICON} aria-hidden />
      </button>
    </div>
  );
}
