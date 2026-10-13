"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripStatus } from "@pureluxe/db";
import type { JourneyStatusAction } from "@pureluxe/shared";
import {
  LuBan,
  LuCheck,
  LuChevronDown,
  LuCircleCheck,
  LuCompass,
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
import { getJourneyQuoteUrl, setJourneyStatus } from "@/lib/api/trips";
import { showApiError, showSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import { isQuoteWithClient } from "@/lib/trip-builder/trip-lock";
import { formatTripStatus } from "@/lib/trips/journey-format";
import { cn } from "@/lib/utils/cn";

type StatusAction = JourneyStatusAction;

const CONFIRM: Record<
  StatusAction,
  { title: string; description: string; confirmLabel: string; destructive?: boolean }
> = {
  send: {
    title: "Quote sent to the client?",
    description:
      "The trip moves to sent to client. If the plan changes in Trip Builder, it goes back to building.",
    confirmLabel: "Sent to client",
  },
  waiting: {
    title: "Waiting on the client?",
    description:
      "Use this when the client has replied and you need something from them, like a decision, passports, or payment.",
    confirmLabel: "Waiting on client",
  },
  accept: {
    title: "Client accepted this quote?",
    description: "The trip moves to booking and the price locks.",
    confirmLabel: "Client accepted",
  },
  reopen: {
    title: "Reopen this quote?",
    description:
      "Use this when the client wants a change after accepting. The price unlocks and the trip goes back to building. Edit in Trip Builder, then send the new quote.",
    confirmLabel: "Reopen quote",
  },
  confirm: {
    title: "Mark this trip confirmed?",
    description: "Use this when the trip is booked, whenever you are ready.",
    confirmLabel: "Mark confirmed",
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
      label: "Sent to client",
      icon: <LuSend className={ICON} aria-hidden />,
      hint: canMark ? "Quote delivered, no reply yet" : noQuote,
      disabled: !canMark,
      onClick: () => choose("send"),
    });
  }

  if (quoteStage && status !== "waiting_on_client") {
    items.push({
      key: "waiting",
      label: "Waiting on client",
      icon: <LuHourglass className={ICON} aria-hidden />,
      hint: canMark ? "They replied; you need something from them" : noQuote,
      disabled: !canMark,
      onClick: () => choose("waiting"),
    });
  }

  if (quoteStage) {
    const ready = withClient && quote.file;
    items.push({
      key: "accept",
      label: "Client accepted",
      icon: <LuCheck className={ICON} aria-hidden />,
      hint: ready ? "Moves to booking and locks the price" : "Send the quote to the client first",
      disabled: !ready,
      onClick: () => choose("accept"),
    });
  }

  if (status === "booking" || status === "confirmed") {
    items.push({
      key: "reopen",
      label: "Reopen quote",
      icon: <LuRotateCcw className={ICON} aria-hidden />,
      hint: "The client wants a change. Unlocks the price, back to Building",
      onClick: () => choose("reopen"),
    });
  }

  if (status !== "confirmed") {
    items.push({
      key: "confirm",
      label: "Mark confirmed",
      icon: <LuCircleCheck className={ICON} aria-hidden />,
      hint: "The trip is booked",
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
}: {
  tripId: string;
  status: TripStatus;
  quoteReady: boolean;
  quoteFile: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<StatusAction | null>(null);

  const items =
    canWrite && status !== "cancelled"
      ? statusMenuItems(status, { ready: quoteReady, file: quoteFile }, setPending)
      : [];

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
      <Link
        href={pageRoutes.tripBuilderTrip(tripId)}
        className={cn(studioButtonClass("primary", "sm"), "w-full justify-center sm:w-auto")}
      >
        <LuCompass className={ICON} aria-hidden />
        Trip Builder
      </Link>
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
        config={pending ? CONFIRM[pending] : null}
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
