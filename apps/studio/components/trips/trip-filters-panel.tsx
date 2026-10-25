"use client";

import { useState } from "react";

import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import {
  EMPTY_TRIP_ADVANCED_FILTERS,
  type TripAdvancedFilters,
  type TripOwnerFilterOption,
} from "@/lib/trips";
import { cn } from "@/lib/utils/cn";

type TripFiltersDialogProps = {
  open: boolean;
  value: TripAdvancedFilters;
  ownerOptions: TripOwnerFilterOption[];
  onClose: () => void;
  onApply: (value: TripAdvancedFilters) => void;
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
}: Omit<TripFiltersDialogProps, "open">) {
  const [draft, setDraft] = useState(value);
  const dateRangeInvalid =
    Boolean(draft.starts_from) &&
    Boolean(draft.starts_to) &&
    draft.starts_from > draft.starts_to;

  return (
    <Modal
      open
      onClose={onClose}
      title="Filters"
      description="Narrow the trip list. Apply when you’re ready."
      footer={
        <>
          <ModalButton
            onClick={() => {
              setDraft(EMPTY_TRIP_ADVANCED_FILTERS);
              onApply(EMPTY_TRIP_ADVANCED_FILTERS);
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
          <FieldLabel htmlFor="trip-filter-stage">Stage</FieldLabel>
          <select
            id="trip-filter-stage"
            value={draft.stage}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                stage: event.target.value as TripAdvancedFilters["stage"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="building">Building</option>
            <option value="quote_sent">Sent to client</option>
            <option value="waiting_on_client">Waiting on client</option>
            <option value="booking">Booking</option>
            <option value="past">Past</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="trip-filter-client">Client</FieldLabel>
          <select
            id="trip-filter-client"
            value={draft.client_tier}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                client_tier: event.target.value as TripAdvancedFilters["client_tier"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="vip">VIP</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="trip-filter-price">Price</FieldLabel>
          <select
            id="trip-filter-price"
            value={draft.price}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                price: event.target.value as TripAdvancedFilters["price"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="locked">Locked</option>
            <option value="open">Still open</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="trip-filter-payment">Client payment</FieldLabel>
          <select
            id="trip-filter-payment"
            value={draft.payment}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                payment: event.target.value as TripAdvancedFilters["payment"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="not_started">Not started</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="trip-filter-quote">Quote PDF</FieldLabel>
          <select
            id="trip-filter-quote"
            value={draft.quote}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quote: event.target.value as TripAdvancedFilters["quote"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            <option value="stale">Needs a new PDF</option>
            <option value="current">Up to date</option>
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="trip-filter-owner">Relationship owner</FieldLabel>
          <select
            id="trip-filter-owner"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="trip-filter-starts-from">Starts from</FieldLabel>
            <input
              id="trip-filter-starts-from"
              type="date"
              value={draft.starts_from}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  starts_from: event.target.value,
                }))
              }
              className={cn(modalFieldClassName)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="trip-filter-starts-to">Starts to</FieldLabel>
            <input
              id="trip-filter-starts-to"
              type="date"
              value={draft.starts_to}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  starts_to: event.target.value,
                }))
              }
              className={cn(modalFieldClassName)}
            />
          </div>
        </div>
        {dateRangeInvalid ? (
          <p className="text-sm text-danger-ink" role="alert">Starts to must be on or after starts from.</p>
        ) : null}
      </div>
    </Modal>
  );
}

export function TripFiltersDialog({
  open,
  value,
  ownerOptions,
  onClose,
  onApply,
}: TripFiltersDialogProps) {
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
