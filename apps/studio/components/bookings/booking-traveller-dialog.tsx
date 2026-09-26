"use client";

import { useState, type FormEvent } from "react";
import {
  BOOKING_TRAVELLER_GENDERS,
  BOOKING_TRAVELLER_ROLES,
  type CreateBookingTravellerBody,
  type UpdateBookingTravellerBody,
} from "@pureluxe/shared";
import type { BookingTraveller } from "@pureluxe/db";

import { CountryCombobox } from "@/components/ui";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  formatTravellerGender,
  formatTravellerRole,
} from "@/lib/bookings";
import {
  clientTitleSelectOptions,
  normalizeClientTitle,
} from "@/lib/clients";
import { resolveCountryCode } from "@/lib/geo/country-code";
import { showWarningToast } from "@/lib/feedback/toast";
import { cn } from "@/lib/utils/cn";

type BookingTravellerDialogProps = {
  traveller: BookingTraveller | null;
  loading: boolean;
  onClose: () => void;
  onSave: (
    input: CreateBookingTravellerBody | UpdateBookingTravellerBody,
  ) => Promise<void>;
};

export function BookingTravellerDialog({
  traveller,
  loading,
  onClose,
  onSave,
}: BookingTravellerDialogProps) {
  const isEdit = Boolean(traveller);
  const [fullName, setFullName] = useState(traveller?.full_name ?? "");
  const [title, setTitle] = useState(() =>
    normalizeClientTitle(traveller?.title),
  );
  const [role, setRole] = useState<(typeof BOOKING_TRAVELLER_ROLES)[number]>(
    traveller?.role ?? "adult",
  );
  const [gender, setGender] = useState(traveller?.gender ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    traveller?.date_of_birth ?? "",
  );
  const [passportNumber, setPassportNumber] = useState(
    traveller?.passport_number ?? "",
  );
  const [passportNationality, setPassportNationality] = useState(() =>
    resolveCountryCode(traveller?.passport_nationality),
  );
  const [passportExpiry, setPassportExpiry] = useState(
    traveller?.passport_expiry ?? "",
  );

  const titleOptions = clientTitleSelectOptions(traveller?.title);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim()) {
      showWarningToast("Enter the traveller's name.");
      return;
    }

    await onSave({
      full_name: fullName.trim(),
      title: title.trim() || null,
      role: role as (typeof BOOKING_TRAVELLER_ROLES)[number],
      gender: gender
        ? (gender as (typeof BOOKING_TRAVELLER_GENDERS)[number])
        : null,
      date_of_birth: dateOfBirth.trim() || null,
      passport_number: passportNumber.trim() || null,
      passport_nationality: passportNationality.trim() || null,
      passport_expiry: passportExpiry.trim() || null,
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit traveller" : "Add traveller"}
      description="Names and passport details used for hotels and ticketing."
      size="lg"
      footer={
        <>
          <ModalButton
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </ModalButton>
          <ModalButton
            type="submit"
            form="booking-traveller-form"
            variant="primary"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Saving…" : "Save"}
          </ModalButton>
        </>
      }
    >
      <form
        id="booking-traveller-form"
        onSubmit={handleSubmit}
        className="min-w-0 space-y-4 overflow-x-hidden px-5 py-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-ink">Full name</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={cn(modalFieldClassName)}
              required
            />
          </label>
          <label className="block" htmlFor="traveller-title">
            <span className="text-sm font-medium text-ink">Title</span>
            <select
              id="traveller-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={cn(modalFieldClassName)}
            >
              {titleOptions.map((option) => (
                <option key={option.value || "none"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Role</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value as (typeof BOOKING_TRAVELLER_ROLES)[number],
                )
              }
              className={cn(modalFieldClassName)}
            >
              {BOOKING_TRAVELLER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {formatTravellerRole(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Gender</span>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className={cn(modalFieldClassName)}
            >
              <option value="">Unspecified</option>
              {BOOKING_TRAVELLER_GENDERS.map((value) => (
                <option key={value} value={value}>
                  {formatTravellerGender(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Date of birth</span>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Passport number</span>
            <input
              value={passportNumber}
              onChange={(event) => setPassportNumber(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </label>
          <div className="block">
            <span className="text-sm font-medium text-ink">Nationality</span>
            <div className="mt-1.5">
              <CountryCombobox
                id="traveller-nationality"
                value={passportNationality}
                onChange={setPassportNationality}
                placeholder="Search countries…"
              />
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-ink">Passport expiry</span>
            <input
              type="date"
              value={passportExpiry}
              onChange={(event) => setPassportExpiry(event.target.value)}
              className={cn(modalFieldClassName)}
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}
