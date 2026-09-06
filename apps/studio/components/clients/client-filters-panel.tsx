"use client";

import { useState } from "react";
import type { ClientSourceFilter } from "@pureluxe/shared";

import {
  EMPTY_ADVANCED_FILTERS,
  type ClientAdvancedFilters,
  type ClientDirectoryFilters,
} from "@/lib/clients";
import { Modal, ModalButton, modalFieldClassName } from "@/components/ui/modal";
import { studioChipClass } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type ClientFiltersDialogProps = {
  open: boolean;
  value: ClientAdvancedFilters;
  options: ClientDirectoryFilters;
  onClose: () => void;
  onApply: (value: ClientAdvancedFilters) => void;
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
  options,
  onClose,
  onApply,
}: Omit<ClientFiltersDialogProps, "open">) {
  const [draft, setDraft] = useState(value);
  const dateRangeInvalid =
    Boolean(draft.created_from) &&
    Boolean(draft.created_to) &&
    draft.created_from > draft.created_to;

  function toggleSource(source: ClientSourceFilter) {
    setDraft((current) => {
      if (current.sources.includes(source)) {
        return {
          ...current,
          sources: current.sources.filter((item) => item !== source),
        };
      }
      return { ...current, sources: [...current.sources, source] };
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Filters"
      description="Narrow who appears in the list. Apply when you’re ready."
      footer={
        <>
          <ModalButton
            onClick={() => {
              setDraft(EMPTY_ADVANCED_FILTERS);
              onApply(EMPTY_ADVANCED_FILTERS);
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
      <div className="max-h-[min(52dvh,28rem)] space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:max-h-[min(65vh,28rem)]">
        <div>
          <FieldLabel htmlFor="filter-tier">Tier level</FieldLabel>
          <select
            id="filter-tier"
            value={draft.tier}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                tier: event.target.value as ClientAdvancedFilters["tier"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            {options.tiers.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="filter-review-status">Review status</FieldLabel>
          <select
            id="filter-review-status"
            value={draft.review_status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                review_status: event.target
                  .value as ClientAdvancedFilters["review_status"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            {options.review_statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {options.toggles.map((toggle) => (
          <label
            key={toggle.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3"
          >
            <input
              type="checkbox"
              checked={draft[toggle.id]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [toggle.id]: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium text-ink">{toggle.label}</span>
          </label>
        ))}

        <div>
          <FieldLabel htmlFor="filter-owner">Relationship owner</FieldLabel>
          <select
            id="filter-owner"
            value={draft.owner}
            onChange={(event) =>
              setDraft((current) => ({ ...current, owner: event.target.value }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {options.owners.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="filter-completeness">Profile completeness</FieldLabel>
          <select
            id="filter-completeness"
            value={draft.completeness}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                completeness: event.target
                  .value as ClientAdvancedFilters["completeness"],
              }))
            }
            className={cn(modalFieldClassName)}
          >
            <option value="any">Any</option>
            {options.completeness.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {options.created_date_range.enabled ? (
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="filter-created-from">Created from</FieldLabel>
                <input
                  id="filter-created-from"
                  type="date"
                  value={draft.created_from}
                  max={draft.created_to || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      created_from: event.target.value,
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
                <FieldLabel htmlFor="filter-created-to">Created to</FieldLabel>
                <input
                  id="filter-created-to"
                  type="date"
                  value={draft.created_to}
                  min={draft.created_from || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      created_to: event.target.value,
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
                Created from must be on or before Created to.
              </p>
            ) : null}
          </div>
        ) : null}

        <fieldset>
          <legend className="text-sm font-medium text-ink">Source</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.sources.map((source) => {
              const active = draft.sources.includes(
                source.value as ClientSourceFilter,
              );

              return (
                <button
                  key={source.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    toggleSource(source.value as ClientSourceFilter)
                  }
                  className={studioChipClass(active)}
                >
                  {source.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export function ClientFiltersDialog({
  open,
  value,
  options,
  onClose,
  onApply,
}: ClientFiltersDialogProps) {
  if (!open) return null;

  return (
    <FiltersForm
      key={JSON.stringify(value)}
      value={value}
      options={options}
      onClose={onClose}
      onApply={onApply}
    />
  );
}
