"use client";

import { useState } from "react";

import {
  EMPTY_BOOKING_ADVANCED_FILTERS,
  type BookingAdvancedFilters,
  type BookingOwnerFilterOption,
} from "@/lib/bookings";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

type BookingFiltersDialogProps = {
  open: boolean;
  value: BookingAdvancedFilters;
  ownerOptions: BookingOwnerFilterOption[];
  onClose: () => void;
  onApply: (value: BookingAdvancedFilters) => void;
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
      {children}
    </label>
  );
}

function FiltersForm({
  value,
  ownerOptions,
  onClose,
  onApply,
}: Omit<BookingFiltersDialogProps, "open">) {
  const [draft, setDraft] = useState(value);
  const dateRangeInvalid =
    Boolean(draft.start_from) &&
    Boolean(draft.start_to) &&
    draft.start_from > draft.start_to;

  return (
    <Modal
      open
      onClose={onClose}
      title="Filters"
      description="Narrow the list. Apply when you’re ready."
      footer={
        <>
          <ModalButton
            onClick={() => {
              setDraft(EMPTY_BOOKING_ADVANCED_FILTERS);
              onApply(EMPTY_BOOKING_ADVANCED_FILTERS);
              onClose();
            }}
            className="w-full sm:mr-auto sm:w-auto"
          >
            Clear
          </ModalButton>
          <ModalButton onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            disabled={dateRangeInvalid}
            onClick={() => {
              if (dateRangeInvalid) return;
              onApply(draft);
              onClose();
            }}
            className="w-full sm:w-auto"
          >
            Apply filters
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4 px-5 py-5">
        <div>
          <FieldLabel htmlFor="booking-filter-type">Service type</FieldLabel>
          <select
            id="booking-filter-type"
            value={draft.type}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                type: event.target.value as BookingAdvancedFilters["type"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="booking-filter-status">Booking status</FieldLabel>
          <select
            id="booking-filter-status"
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value as BookingAdvancedFilters["status"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On hold</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="superseded">Superseded</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="booking-filter-work">Needs attention</FieldLabel>
          <select
            id="booking-filter-work"
            value={draft.work}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                work: event.target.value as BookingAdvancedFilters["work"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="needs_confirm">Needs confirmation</option>
            <option value="cancel_soon">Cancel soon</option>
            <option value="depart_soon">Starting soon</option>
            <option value="arriving">Starts today</option>
            <option value="in_house">On trip now</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="booking-filter-owner">
            Relationship owner
          </FieldLabel>
          <select
            id="booking-filter-owner"
            value={draft.owner}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                owner: event.target.value,
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="booking-filter-start-from">
                Start from
              </FieldLabel>
              <input
                id="booking-filter-start-from"
                type="date"
                value={draft.start_from}
                max={draft.start_to || undefined}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    start_from: event.target.value,
                  }))
                }
                className={cn(
                  modalFieldClassName,
                  dateRangeInvalid && "ring-2 ring-red-400/50",
                )}
                aria-invalid={dateRangeInvalid}
              />
            </div>
            <div>
              <FieldLabel htmlFor="booking-filter-start-to">Start to</FieldLabel>
              <input
                id="booking-filter-start-to"
                type="date"
                value={draft.start_to}
                min={draft.start_from || undefined}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    start_to: event.target.value,
                  }))
                }
                className={cn(
                  modalFieldClassName,
                  dateRangeInvalid && "ring-2 ring-red-400/50",
                )}
                aria-invalid={dateRangeInvalid}
              />
            </div>
          </div>
          {dateRangeInvalid ? (
            <p className="text-xs text-red-700" role="alert">
              Start from must be on or before Start to.
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
          <input
            type="checkbox"
            checked={draft.missing_ref}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                missing_ref: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-medium text-ink">Missing ref</span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
          <input
            type="checkbox"
            checked={draft.no_trip}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                no_trip: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-medium text-ink">No trip linked</span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3">
          <input
            type="checkbox"
            checked={draft.ticket_deadline_soon}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                ticket_deadline_soon: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-medium text-ink">
            Ticket deadline soon (flights)
          </span>
        </label>
      </div>
    </Modal>
  );
}

/** Advanced filters dialog — type, status, attention, owner, dates, ops flags. */
export function BookingFiltersDialog({
  open,
  value,
  ownerOptions,
  onClose,
  onApply,
}: BookingFiltersDialogProps) {
  if (!open) return null;

  return (
    <FiltersForm
      key={JSON.stringify(value)}
      value={value}
      ownerOptions={ownerOptions}
      onClose={onClose}
      onApply={onApply}
    />
  );
}
