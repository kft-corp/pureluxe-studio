"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  assignBookingOwner,
  cancelBooking,
  confirmBooking,
  createBookingTraveller,
  deleteBookingTraveller,
  linkBookingTrip,
  supersedeBooking,
  updateBookingTraveller,
} from "@/lib/api/bookings";
import type { BookingDetail } from "@/lib/bookings";
import type { BookingConfirmAction } from "@/lib/bookings/confirm-dialog-config";
import { showApiError, showOptionalSuccessToast } from "@/lib/feedback/toast";
import { pageRoutes } from "@/lib/routes";
import type {
  AssignBookingOwnerBody,
  ConfirmBookingBody,
  CreateBookingTravellerBody,
  LinkBookingTripBody,
  UpdateBookingTravellerBody,
} from "@pureluxe/shared";

import type { BookingEditSection } from "./booking-edit-section-dialog";
import type { BookingDetailTab } from "./booking-detail-tabs";

type UseBookingDetailOptions = {
  initialDetail: BookingDetail;
};

function travellerDisplayName(input: {
  title?: string | null;
  full_name: string;
}): string {
  return [input.title?.trim(), input.full_name].filter(Boolean).join(" ");
}

/** Booking detail page state — tabs, edits, lifecycle actions. */
export function useBookingDetail({ initialDetail }: UseBookingDetailOptions) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [activeTab, setActiveTab] = useState<BookingDetailTab>("overview");
  const [editSection, setEditSection] = useState<BookingEditSection | null>(
    null,
  );
  const [confirmAction, setConfirmAction] =
    useState<BookingConfirmAction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [travellerDialogOpen, setTravellerDialogOpen] = useState(false);
  const [editingTravellerId, setEditingTravellerId] = useState<string | null>(
    null,
  );
  const [pendingDeleteTravellerId, setPendingDeleteTravellerId] = useState<
    string | null
  >(null);
  const [travellerBusy, setTravellerBusy] = useState(false);

  function closeConfirm() {
    setConfirmAction(null);
    setCancelReason("");
    setPendingDeleteTravellerId(null);
  }

  async function runBookingAction(
    work: () => Promise<{ data: BookingDetail; message?: string }>,
  ) {
    setActionLoading(true);
    try {
      const response = await work();
      setDetail(response.data);
      closeConfirm();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmBooking(input: ConfirmBookingBody = {}) {
    await runBookingAction(() => confirmBooking(detail.booking.id, input));
  }

  async function handleCancelBooking() {
    if (!cancelReason.trim()) return;
    await runBookingAction(() =>
      cancelBooking(detail.booking.id, {
        cancellation_reason: cancelReason.trim(),
      }),
    );
  }

  async function handleAmendBooking() {
    setActionLoading(true);
    try {
      const response = await supersedeBooking(detail.booking.id);
      closeConfirm();
      showOptionalSuccessToast(response.message);
      router.push(pageRoutes.booking(response.data.booking.id));
    } catch (error) {
      showApiError(error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssignOwner(input: AssignBookingOwnerBody) {
    setActionLoading(true);
    try {
      const response = await assignBookingOwner(detail.booking.id, input);
      setDetail(response.data);
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLinkTrip(input: LinkBookingTripBody) {
    setActionLoading(true);
    try {
      const response = await linkBookingTrip(detail.booking.id, input);
      setDetail(response.data);
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
      throw error;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveTraveller(
    input: CreateBookingTravellerBody | UpdateBookingTravellerBody,
  ) {
    setTravellerBusy(true);
    try {
      const response = editingTravellerId
        ? await updateBookingTraveller(
            detail.booking.id,
            editingTravellerId,
            input as UpdateBookingTravellerBody,
          )
        : await createBookingTraveller(
            detail.booking.id,
            input as CreateBookingTravellerBody,
          );
      setDetail(response.data);
      setTravellerDialogOpen(false);
      setEditingTravellerId(null);
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setTravellerBusy(false);
    }
  }

  function requestDeleteTraveller(travellerId: string) {
    setPendingDeleteTravellerId(travellerId);
    setConfirmAction("delete_traveller");
  }

  async function handleDeleteTraveller() {
    if (!pendingDeleteTravellerId) return;
    setTravellerBusy(true);
    try {
      const response = await deleteBookingTraveller(
        detail.booking.id,
        pendingDeleteTravellerId,
      );
      setDetail(response.data);
      closeConfirm();
      showOptionalSuccessToast(response.message);
    } catch (error) {
      showApiError(error);
    } finally {
      setTravellerBusy(false);
    }
  }

  const editingTraveller =
    editingTravellerId == null
      ? null
      : (detail.travellers.find((row) => row.id === editingTravellerId) ??
        null);

  const pendingDeleteTraveller =
    pendingDeleteTravellerId == null
      ? null
      : (detail.travellers.find((row) => row.id === pendingDeleteTravellerId) ??
        null);

  return {
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
    requestDeleteTraveller,
    handleDeleteTraveller,
    pendingDeleteTravellerName: pendingDeleteTraveller
      ? travellerDisplayName(pendingDeleteTraveller)
      : null,
  };
}
