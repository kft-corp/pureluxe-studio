"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LuArrowLeft,
  LuCheck,
  LuEllipsis,
  LuPencil,
} from "react-icons/lu";

import {
  ConfirmDialog,
  PageStack,
  PageToolbar,
  SnapshotCard,
  studioButtonClass,
} from "@/components/ui";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import type { BookingDetail } from "@/lib/bookings";
import {
  displayOrDash,
  formatBookingMoney,
  formatBookingStatus,
  resolveBookingDeadline,
} from "@/lib/bookings";
import { getBookingConfirmConfig } from "@/lib/bookings/confirm-dialog-config";
import { pageRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils/cn";

import { BookingActivityPanel } from "./booking-activity-panel";
import { BookingCommercialPanel } from "./booking-commercial-panel";
import { bookingServiceIcon } from "./booking-detail-icons";
import {
  clientTripLine,
  datesLine,
  deadlineHint,
  serviceSubtitle,
  truncateMiddle,
} from "./booking-detail-shared";
import { BookingDetailTabs } from "./booking-detail-tabs";
import {
  BookingEditSectionDialog,
  type BookingEditSection,
} from "./booking-edit-section-dialog";
import { BookingNotesPanel } from "./booking-notes-panel";
import { BookingOverviewPanel } from "./booking-overview-panel";
import { BookingPolicyPanel } from "./booking-policy-panel";
import { BookingStatusPill, BookingVipBadge } from "./booking-status-pill";
import { BookingTravellerDialog } from "./booking-traveller-dialog";
import { BookingTravellersPanel } from "./booking-travellers-panel";
import { useBookingDetail } from "./use-booking-detail";

type BookingDetailContentProps = {
  initialDetail: BookingDetail;
  canWrite: boolean;
  ownerOptions?: Array<{ id: string; name: string }>;
};

const EDIT_MENU_ITEMS: Array<{ section: BookingEditSection; label: string }> = [
  { section: "reservation", label: "Reservation" },
  { section: "service_details", label: "Stay / service details" },
  { section: "commercial", label: "Commercial" },
  { section: "policy", label: "Policy & status" },
  { section: "notes", label: "Internal notes" },
  { section: "context", label: "Context (trip & owner)" },
];

const LIFECYCLE_STATUSES = new Set(["pending", "on_hold", "confirmed"]);

type ToolbarMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

function ToolbarMenu({
  trigger,
  items,
  menuClassName = "min-w-[10rem]",
}: {
  trigger: (args: { open: boolean; toggle: () => void }) => ReactNode;
  items: ToolbarMenuItem[];
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open ? (
        <div
          className={cn(
            "absolute right-0 z-20 mt-1 rounded-lg border border-border bg-surface py-1 shadow-lg",
            menuClassName,
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover",
                item.danger ? "text-red-700" : "text-ink",
              )}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Booking detail — hero, snapshot strip, tabbed sections, section edit. */
export function BookingDetailContent({
  initialDetail,
  canWrite,
  ownerOptions = [],
}: BookingDetailContentProps) {
  const state = useBookingDetail({ initialDetail });
  const {
    detail,
    setDetail,
    activeTab,
    setActiveTab,
    editSection,
    setEditSection,
    confirmAction,
    setConfirmAction,
    closeConfirm,
    cancelReason,
    setCancelReason,
    actionLoading,
    handleConfirmBooking,
    handleCancelBooking,
    handleAmendBooking,
    handleAssignOwner,
    handleLinkTrip,
    travellerDialogOpen,
    setTravellerDialogOpen,
    setEditingTravellerId,
    editingTraveller,
    travellerBusy,
    handleSaveTraveller,
    handleDeleteTraveller,
    requestDeleteTraveller,
    pendingDeleteTravellerName,
  } = state;

  const { booking, travellers, recent_audit: recentAudit } = detail;
  const canEdit = canWrite && booking.status !== "superseded";
  const needsConfirm =
    booking.status === "pending" || booking.status === "on_hold";
  const canLifecycle = canEdit && LIFECYCLE_STATUSES.has(booking.status);

  const ServiceIcon = bookingServiceIcon(booking.service_type);
  const deadline = resolveBookingDeadline(
    booking.cancellation_deadline,
    booking.ticket_time_limit,
  );
  const stay = datesLine(booking.start_date, booking.end_date, booking.nights);
  const sellLabel = formatBookingMoney(booking.sell_amount, booking.currency);
  const refLabel = displayOrDash(booking.supplier_ref);
  const deadlineUrgent =
    deadline.kind === "cancel" || deadline.kind === "ticket";

  const confirmConfig = getBookingConfirmConfig({
    action:
      confirmAction === "cancel" || confirmAction == null
        ? null
        : confirmAction,
    hasSupplierRef: Boolean(booking.supplier_ref?.trim()),
    travellerName: pendingDeleteTravellerName,
  });

  return (
    <PageStack className="min-w-0">
      <div>
        <Link
          href={pageRoutes.bookings}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          All bookings
        </Link>
      </div>

      {booking.status === "superseded" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This booking was superseded by an amend. Open the current version from
          Activity or the directory — edits are locked here.
        </div>
      ) : null}

      <PageToolbar className="min-w-0 overflow-hidden bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--surface)_100%)]">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface text-ink shadow-sm sm:h-16 sm:w-16">
              <ServiceIcon
                className="h-5 w-5 sm:h-7 sm:w-7"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full wrap-break-word font-serif text-xl font-medium tracking-tight text-ink sm:text-3xl">
                  {booking.title}
                </h2>
                <BookingStatusPill status={booking.status} />
                {booking.vip_flag ? <BookingVipBadge /> : null}
              </div>

              <p className="mt-1 wrap-break-word text-sm text-ink-muted">
                {serviceSubtitle(booking)}
              </p>

              <p className="mt-2 wrap-break-word text-sm text-ink-muted">
                {clientTripLine(booking)}
              </p>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                {booking.client ? (
                  <Link
                    href={pageRoutes.client(booking.client.id)}
                    className="text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
                  >
                    Open client
                  </Link>
                ) : null}
                {booking.trip_id ? (
                  <Link
                    href={pageRoutes.trips}
                    className="text-ink-muted underline-offset-2 transition hover:text-ink hover:underline"
                    title={booking.trip_id}
                  >
                    Open trips
                  </Link>
                ) : null}
              </div>

              {refLabel !== "—" ? (
                <p className="mt-2 max-w-full text-xs text-ink-muted">
                  Confirmation ref{" "}
                  <span
                    className="inline-block max-w-full wrap-break-word font-mono font-medium text-ink"
                    title={refLabel}
                  >
                    {truncateMiddle(refLabel, 42)}
                  </span>
                </p>
              ) : canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditSection("commercial")}
                  className="mt-2 text-pretty text-left text-xs font-medium text-amber-800 underline-offset-2 transition hover:underline"
                >
                  Missing supplier reference — add confirmation / PNR
                </button>
              ) : (
                <p className="mt-2 text-pretty text-xs font-medium text-amber-800">
                  Missing supplier reference — add one when you confirm.
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
            {canEdit && needsConfirm ? (
              <button
                type="button"
                onClick={() => setConfirmAction("confirm")}
                className={cn(
                  studioButtonClass("success", "sm"),
                  "w-full justify-center sm:w-auto",
                )}
              >
                <LuCheck className="h-3.5 w-3.5" aria-hidden />
                Confirm booking
              </button>
            ) : null}
            {canEdit ? (
              <ToolbarMenu
                menuClassName="min-w-[12rem]"
                items={EDIT_MENU_ITEMS.map((item) => ({
                  key: item.section,
                  label: item.label,
                  onClick: () => setEditSection(item.section),
                }))}
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                      studioButtonClass("secondary", "sm"),
                      "w-full justify-center sm:w-auto",
                    )}
                    aria-expanded={open}
                  >
                    <LuPencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                )}
              />
            ) : null}
            {canLifecycle ? (
              <ToolbarMenu
                items={[
                  {
                    key: "amend",
                    label: "Amend booking",
                    onClick: () => setConfirmAction("amend"),
                  },
                  {
                    key: "cancel",
                    label: "Cancel booking",
                    onClick: () => setConfirmAction("cancel"),
                    danger: true,
                  },
                ]}
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-raised text-ink-muted transition hover:bg-surface-hover hover:text-ink"
                    aria-label="More actions"
                    aria-expanded={open}
                  >
                    <LuEllipsis className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard
            label="Travel dates"
            value={stay.value}
            hint={stay.hint}
          />
          <SnapshotCard
            label="Status"
            value={formatBookingStatus(booking.status)}
            hint={
              needsConfirm ? "Awaiting confirmation" : "Current lifecycle stage"
            }
          />
          <SnapshotCard
            label="Next deadline"
            value={deadline.label}
            hint={deadlineHint(deadline.kind)}
            className={
              deadlineUrgent
                ? "border-amber-200 bg-amber-50/80 [&_*]:text-amber-950"
                : undefined
            }
          />
          <SnapshotCard
            label="Sell price"
            value={sellLabel}
            hint={
              booking.currency?.trim().toUpperCase() || "Commercial snapshot"
            }
          />
        </div>
      </PageToolbar>

      <BookingDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          travellers: travellers.length,
          activity: recentAudit.length,
        }}
      />

      <div
        role="tabpanel"
        aria-label={`${activeTab} section`}
        className="min-w-0"
      >
        {activeTab === "overview" ? (
          <BookingOverviewPanel
            booking={booking}
            travellerCount={travellers.length}
            activityCount={recentAudit.length}
            canWrite={canEdit}
            onOpenTab={setActiveTab}
            onEditSection={setEditSection}
          />
        ) : null}
        {activeTab === "travellers" ? (
          <BookingTravellersPanel
            travellers={travellers}
            canWrite={canEdit}
            busy={travellerBusy}
            onAdd={() => {
              setEditingTravellerId(null);
              setTravellerDialogOpen(true);
            }}
            onEdit={(travellerId) => {
              setEditingTravellerId(travellerId);
              setTravellerDialogOpen(true);
            }}
            onDelete={requestDeleteTraveller}
          />
        ) : null}
        {activeTab === "commercial" ? (
          <BookingCommercialPanel
            booking={booking}
            canWrite={canEdit}
            onEditSection={setEditSection}
          />
        ) : null}
        {activeTab === "policy" ? (
          <BookingPolicyPanel
            booking={booking}
            canWrite={canEdit}
            onEditSection={setEditSection}
          />
        ) : null}
        {activeTab === "notes" ? (
          <BookingNotesPanel
            booking={booking}
            canWrite={canEdit}
            onEditSection={setEditSection}
          />
        ) : null}
        {activeTab === "activity" ? (
          <BookingActivityPanel booking={booking} recentAudit={recentAudit} />
        ) : null}
      </div>

      {editSection ? (
        <BookingEditSectionDialog
          open
          section={editSection}
          detail={detail}
          ownerOptions={ownerOptions}
          actionLoading={actionLoading}
          onClose={() => setEditSection(null)}
          onSuccess={setDetail}
          onAssignOwner={async (ownerId) => {
            await handleAssignOwner({ relationship_owner_id: ownerId });
          }}
          onLinkTrip={async (tripId) => {
            await handleLinkTrip({ trip_id: tripId });
          }}
        />
      ) : null}

      {travellerDialogOpen ? (
        <BookingTravellerDialog
          traveller={editingTraveller}
          loading={travellerBusy}
          onClose={() => {
            setTravellerDialogOpen(false);
            setEditingTravellerId(null);
          }}
          onSave={handleSaveTraveller}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmConfig)}
        loading={
          confirmAction === "delete_traveller" ? travellerBusy : actionLoading
        }
        config={confirmConfig}
        onClose={closeConfirm}
        onConfirm={() => {
          if (confirmAction === "confirm") void handleConfirmBooking();
          else if (confirmAction === "amend") void handleAmendBooking();
          else if (confirmAction === "delete_traveller")
            void handleDeleteTraveller();
        }}
      />

      {confirmAction === "cancel" ? (
        <Modal
          open
          onClose={closeConfirm}
          title="Cancel this booking?"
          description="This keeps the record for history. Add a short ops reason."
          footer={
            <>
              <ModalButton
                onClick={closeConfirm}
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                Keep booking
              </ModalButton>
              <ModalButton
                variant="danger"
                disabled={actionLoading || !cancelReason.trim()}
                className="w-full sm:w-auto"
                onClick={() => handleCancelBooking()}
              >
                {actionLoading ? "Cancelling…" : "Cancel booking"}
              </ModalButton>
            </>
          }
        >
          <div className="px-5 py-5">
            <label htmlFor="cancel-reason" className="block">
              <span className="text-sm font-medium text-ink">
                Cancellation reason
              </span>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                className={cn(modalFieldClassName, "mt-1.5 resize-y")}
                placeholder="e.g. Guest cancelled — refund pending"
              />
            </label>
          </div>
        </Modal>
      ) : null}
    </PageStack>
  );
}
